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

function assertOk(error: { message: string } | null, action: string) {
  if (error) {
    throw new Error(`${action} failed: ${error.message}`);
  }
}

function isUploadableImage(file: FormDataEntryValue | null): file is File {
  return file instanceof File && file.size > 0 && file.type.startsWith("image/");
}

export async function submitDepositProof(formData: FormData) {
  const supabase = await supabaseServer();
  const totalAmount = getNumber(formData, "amount");
  const emergencyAmount = getNumber(formData, "emergency_amount");
  const investmentAmount = getNumber(formData, "investment_amount");
  const contributionMonth = getString(formData, "contribution_month");
  const depositDate = getString(formData, "deposit_date");
  const bankReference = getString(formData, "bank_reference");
  const senderName = getString(formData, "sender_name");
  const extractionNotes = getString(formData, "extraction_notes");
  const extractionConfidence = getNumber(formData, "extraction_confidence");
  const proof = formData.get("proof");

  if (!totalAmount || totalAmount <= 0) {
    throw new Error("Deposit amount is required.");
  }

  if (emergencyAmount + investmentAmount !== totalAmount) {
    throw new Error("Emergency and investment allocations must equal the total deposit.");
  }

  if (!contributionMonth || !depositDate) {
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

  if (isUploadableImage(proof)) {
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

    proofUrl = path;
  }

  const { error } = await supabase.from("deposit_submissions").insert({
    member_id: member.id,
    contribution_month: contributionMonth,
    amount: totalAmount,
    emergency_amount: emergencyAmount,
    investment_amount: investmentAmount,
    deposit_date: depositDate,
    bank_reference: bankReference || null,
    sender_name:
      senderName ||
      [member.first_name, member.last_name].filter(Boolean).join(" ") ||
      null,
    proof_url: proofUrl,
    extracted_text: extractionNotes || null,
    confidence:
      extractionConfidence >= 0 && extractionConfidence <= 1
        ? extractionConfidence
        : null,
    status: "submitted",
  });
  assertOk(error, "Submit deposit proof");

  revalidatePath("/funds/deposit-proof");
  revalidatePath("/finance/deposit-submissions");
  revalidatePath("/finance/monthly-savings");
}

export async function approveDepositSubmission(formData: FormData) {
  const supabase = await supabaseServer();
  const submissionId = getString(formData, "submission_id");

  if (!submissionId) return;

  const { error } = await supabase.rpc("approve_deposit_submission_v1", {
    p_submission_id: submissionId,
  });
  assertOk(error, "Approve deposit submission");

  revalidatePath("/finance/deposit-submissions");
  revalidatePath("/finance/monthly-savings");
  revalidatePath("/dashboard");
  revalidatePath("/account/emergency-fund");
  revalidatePath("/account/investment-fund");
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
