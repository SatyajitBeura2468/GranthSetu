"use server";

import { redirect } from "next/navigation";
import { assertOperator } from "@/lib/auth/authorization";
import { circulationErrorMessage } from "@/lib/circulation/errors";
import { parseMinorUnits } from "@/lib/circulation/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RpcClient = { rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }> };
const rpcClient = (client: unknown) => client as RpcClient;
const value = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const uuid = (input: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
function done(message: string): never { redirect(`/operator/circulation?success=${encodeURIComponent(message)}`); }
function fail(error: unknown): never { redirect(`/operator/circulation?error=${encodeURIComponent(circulationErrorMessage(error))}`); }

async function call(name: string, args: Record<string, unknown>) {
  await assertOperator();
  const { data, error } = await rpcClient(await createSupabaseServerClient()).rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

export async function issueLoanAction(formData: FormData) {
  const memberId = value(formData, "memberId"); const copyId = value(formData, "copyId"); const requestId = value(formData, "requestId");
  if (!uuid(memberId) || !uuid(copyId) || !uuid(requestId)) fail("invalid input");
  let result;
  try { result = await call("circulation_issue_loan", { p_member_id: memberId, p_book_copy_id: copyId, p_request_id: requestId, p_notes: value(formData, "notes") || null }); } catch (error) { fail(error); }
  void result;
  done("Loan issued");
}

export async function returnLoanAction(formData: FormData) {
  const loanId = value(formData, "loanId"); const requestId = value(formData, "requestId");
  if (!uuid(loanId) || !uuid(requestId)) fail("invalid input");
  let result;
  try { result = await call("circulation_return_loan", { p_loan_id: loanId, p_request_id: requestId }); } catch (error) { fail(error); }
  void result;
  done("Loan returned");
}

export async function renewLoanAction(formData: FormData) {
  const loanId = value(formData, "loanId"); const requestId = value(formData, "requestId");
  if (!uuid(loanId) || !uuid(requestId)) fail("invalid input");
  let result;
  try { result = await call("circulation_renew_loan", { p_loan_id: loanId, p_request_id: requestId }); } catch (error) { fail(error); }
  void result;
  done("Loan renewed");
}

export async function assessFineAction(formData: FormData) {
  const loanId = value(formData, "loanId"); const requestId = value(formData, "requestId");
  if (!uuid(loanId) || !uuid(requestId)) fail("invalid input");
  let result;
  try { result = await call("circulation_assess_overdue_fine", { p_loan_id: loanId, p_request_id: requestId }); } catch (error) { fail(error); }
  void result;
  done("Fine assessment checked");
}

async function amountAction(formData: FormData, name: string, success: string) {
  const fineId = value(formData, "fineId"); const requestId = value(formData, "requestId"); const amount = parseMinorUnits(value(formData, "amount"));
  if (!uuid(fineId) || !uuid(requestId) || amount === null) fail("invalid amount or request");
  let result;
  try { result = await call(name, { p_fine_id: fineId, p_amount_minor: amount, p_request_id: requestId, ...(name.endsWith("settle_fine") ? { p_note: value(formData, "note") || null } : { p_reason: value(formData, "reason") }) }); } catch (error) { fail(error); }
  void result;
  done(success);
}

export async function settleFineAction(formData: FormData) { return amountAction(formData, "circulation_settle_fine", "Fine settlement recorded"); }
export async function waiveFineAction(formData: FormData) { return amountAction(formData, "circulation_waive_fine", "Fine waiver recorded"); }
