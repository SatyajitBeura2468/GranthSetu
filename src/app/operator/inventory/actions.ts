"use server";

import { redirect } from "next/navigation";
import { assertOperator } from "@/lib/auth/authorization";
import { formValue, nullable } from "@/lib/operator/forms";
import { asOperatorRpcClient, rpcErrorMessage } from "@/lib/operator/rpc";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function fail(message: string): never { redirect(`/operator/inventory?error=${encodeURIComponent(message)}`); }
export async function saveCopyAction(formData: FormData) {
  await assertOperator();
  const supabase = asOperatorRpcClient(await createSupabaseServerClient());
  const id = nullable(formValue(formData, "id"));
  const { data, error } = await supabase.rpc("inventory_upsert_copy", { p_id: id, p_book_id: formValue(formData, "bookId"), p_accession_number: formValue(formData, "accessionNumber"), p_barcode: nullable(formValue(formData, "barcode")), p_location_id: nullable(formValue(formData, "locationId")), p_acquired_on: nullable(formValue(formData, "acquiredOn")), p_acquisition_source: nullable(formValue(formData, "acquisitionSource")), p_replacement_cost_minor: formValue(formData, "replacementCost") ? Math.round(Number(formValue(formData, "replacementCost")) * 100) : null, p_condition_status: formValue(formData, "conditionStatus"), p_operational_state: formValue(formData, "operationalState"), p_expected_updated_at: nullable(formValue(formData, "expectedUpdatedAt")) });
  if (error || typeof data !== "string") fail(rpcErrorMessage(error));
  redirect(`/operator/inventory/${data}?success=${encodeURIComponent(id ? "Copy updated" : "Copy created")}`);
}
