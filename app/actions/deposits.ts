"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/app/lib/supabase/server";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(formData: FormData, key: string) {
  const value = Number(getString(formData, key));
  return Number.isFinite(value) ? value : 0;
}

function isMonthValue(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

function parseContributionMonths(formData: FormData, fallbackMonth: string) {
  const mode = getString(formData, "contribution_mode");
  const rawMonths = getString(formData, "contribution_months");

  if (mode !== "multiple") {
    return fallbackMonth && isMonthValue(fallbackMonth) ? [fallbackMonth] : [];
  }

  try {
    const parsed = JSON.parse(rawMonths);
    if (!Array.isArray(parsed)) return [];

    return [...new Set(parsed)]
      .filter((month): month is string => typeof month === "string" && isMonthValue(month))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return fallbackMonth && isMonthValue(fallbackMonth) ? [fallbackMonth] : [];
  }
}

function splitAmountAcrossMonths(total: number, count: number) {
  if (count <= 1) return [total];

  const base = Math.floor(total / count);
  const remainder = total - base * count;

  return Array.from({ length: count }, (_, index) =>
    base + (index < remainder ? 1 : 0)
  );
}

function assertOk(error: { message: string } | null, action: string) {
  if (error) {
    throw new Error(`${action} failed: ${error.message}`);
  }
}

function isUploadableProof(file: FormDataEntryValue | null): file is File {
  if (!(file instanceof File) || file.size <= 0) return false;

  return (
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    file.type === "text/plain" ||
    /\.pdf$/i.test(file.name) ||
    /\.txt$/i.test(file.name)
  );
}

function getProofFiles(formData: FormData) {
  const proofFiles = formData.getAll("proofs").filter(isUploadableProof);
  const legacyProof = formData.get("proof");

  if (proofFiles.length === 0 && isUploadableProof(legacyProof)) {
    proofFiles.push(legacyProof);
  }

  return proofFiles.slice(0, 6);
}

export async function submitDepositProof(formData: FormData) {
  const supabase = await supabaseServer();
  const totalAmount = getNumber(formData, "amount");
  const emergencyAmount = getNumber(formData, "emergency_amount");
  const investmentAmount = getNumber(formData, "investment_amount");
  const contributionMonth = getString(formData, "contribution_month");
  const contributionMonths = parseContributionMonths(formData, contributionMonth);
  const depositDate = getString(formData, "deposit_date");
  const bankReference = getString(formData, "bank_reference");
  const senderName = getString(formData, "sender_name");
  const extractionNotes = getString(formData, "extraction_notes");
  const extractionConfidence = getNumber(formData, "extraction_confidence");
  const proofs = getProofFiles(formData);

  if (!totalAmount || totalAmount <= 0) {
    throw new Error("Deposit amount is required.");
  }

  if (emergencyAmount + investmentAmount !== totalAmount) {
    throw new Error("Emergency and investment allocations must equal the total deposit.");
  }

  if (!contributionMonths.length || !depositDate) {
    throw new Error("Contribution month and deposit date are required.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("You must be signed in to submit a deposit proof.");
  }

  const { data: member } = await supabase
    .from("members")
    .select("id, first_name, last_name")
    .eq("auth_user_id", session.user.id)
    .eq("status", "approved")
    .maybeSingle<{ id: string; first_name: string | null; last_name: string | null }>();

  if (!member) {
    throw new Error("Only approved members can submit deposit proof.");
  }

  let proofUrl: string | null = null;
  const uploadedProofPaths: string[] = [];

  for (const proof of proofs) {
    const extension = proof.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${session.user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("deposit-proofs")
      .upload(path, proof, {
        cacheControl: "3600",
        contentType: proof.type,
        upsert: false,
      });
    assertOk(uploadError, "Upload deposit proof");

    uploadedProofPaths.push(path);
  }

  proofUrl = uploadedProofPaths[0] ?? null;
  const proofFileNote =
    uploadedProofPaths.length > 0
      ? `Uploaded proof files:\n${uploadedProofPaths.map((path, index) => `${index + 1}. ${path}`).join("\n")}`
      : "";
  const splitNote =
    contributionMonths.length > 1
      ? `Split deposit allocation:\n${contributionMonths
          .map((month, index) => `${index + 1}. ${month}`)
          .join("\n")}`
      : "";
  const extractedText =
    [extractionNotes, splitNote, proofFileNote].filter(Boolean).join("\n\n") ||
    null;
  const emergencySplits = splitAmountAcrossMonths(emergencyAmount, contributionMonths.length);
  const investmentSplits = splitAmountAcrossMonths(investmentAmount, contributionMonths.length);
  const submissions = contributionMonths.map((month, index) => ({
    member_id: member.id,
    contribution_month: month,
    amount: emergencySplits[index] + investmentSplits[index],
    emergency_amount: emergencySplits[index],
    investment_amount: investmentSplits[index],
    deposit_date: depositDate,
    bank_reference: bankReference || null,
    sender_name:
      senderName ||
      [member.first_name, member.last_name].filter(Boolean).join(" ") ||
      null,
    proof_url: proofUrl,
    extracted_text: extractedText,
    confidence:
      extractionConfidence >= 0 && extractionConfidence <= 1
        ? extractionConfidence
        : null,
    status: "submitted",
  }));

  const { error } = await supabase.from("deposit_submissions").insert(submissions);
  assertOk(error, "Submit deposit proof");

  revalidatePath("/funds/deposit-proof");
  revalidatePath("/finance/deposit-submissions");
  revalidatePath("/finance/monthly-savings");
}

export async function approveDepositSubmission(formData: FormData) {
  const supabase = await supabaseServer();
  const submissionId = getString(formData, "submission_id");

  if (!submissionId) return;

  const { data: submission } = await supabase
    .from("deposit_submissions")
    .select("contribution_month")
    .eq("id", submissionId)
    .maybeSingle<{ contribution_month: string | null }>();

  const { error } = await supabase.rpc("approve_deposit_submission_v1", {
    p_submission_id: submissionId,
  });
  assertOk(error, "Approve deposit submission");

  if (submission?.contribution_month) {
    await supabase.rpc("recalculate_monthly_interest_allocations_v1", {
      p_reporting_month: submission.contribution_month,
      p_manual_interest_amount: null,
    });
  }

  revalidatePath("/finance/deposit-submissions");
  revalidatePath("/finance/monthly-savings");
  revalidatePath("/finance/statement-reports");
  revalidatePath("/finance/reports");
  revalidatePath("/chairman/finance-reports");
  revalidatePath("/dashboard");
  revalidatePath("/account/emergency-fund");
  revalidatePath("/account/investment-fund");
  revalidatePath("/account/interest");
}

export async function rejectDepositSubmission(formData: FormData) {
  const supabase = await supabaseServer();
  const submissionId = getString(formData, "submission_id");
  const reason = getString(formData, "rejection_reason");

  if (!submissionId) return;

  const { error } = await supabase.rpc("reject_deposit_submission_v1", {
    p_submission_id: submissionId,
    p_reason: reason || "Finance could not match this deposit to the bank statement.",
  });
  assertOk(error, "Reject deposit submission");

  revalidatePath("/finance/deposit-submissions");
  revalidatePath("/funds/deposit-proof");
}
