"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/app/lib/supabase/server";

export type TransferGeneralSecretaryState = {
  ok: boolean;
  message: string;
  transferId?: string;
};

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function transferGeneralSecretaryAction(
  _previousState: TransferGeneralSecretaryState,
  formData: FormData,
): Promise<TransferGeneralSecretaryState> {
  const incomingMemberId = textValue(formData, "incoming_member_id");
  const reason = textValue(formData, "reason");
  const confirmation = textValue(formData, "confirmation");

  if (!incomingMemberId) {
    return { ok: false, message: "Choose the incoming General Secretary." };
  }

  if (reason.length < 10 || reason.length > 500) {
    return {
      ok: false,
      message: "Explain the transfer reason in 10 to 500 characters.",
    };
  }

  if (confirmation !== "TRANSFER") {
    return {
      ok: false,
      message: "Type TRANSFER exactly to confirm this leadership change.",
    };
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("transfer_general_secretary_v1", {
    p_incoming_member_id: incomingMemberId,
    p_reason: reason,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/governance/leadership");
  revalidatePath("/chairman/finance-overview");
  revalidatePath("/system/users");
  revalidatePath("/dashboard");
  revalidatePath("/members/meetings");

  return {
    ok: true,
    message:
      "General Secretary transferred. The former GS is now a normal member and the incoming GS has authority.",
    transferId: typeof data === "string" ? data : undefined,
  };
}
