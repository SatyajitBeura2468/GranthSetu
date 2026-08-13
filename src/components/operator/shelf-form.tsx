import { workspaceMutationAction } from "@/app/operator/[libraryCode]/actions";
import { MutationRequestId, MutationSubmitButton } from "@/components/operator/mutation-controls";

export function ShelfForm({ libraryCode, shelf }: { libraryCode: string; shelf?: { id: string; display_name: string; location_code: string; status: string } }) {
  return <form action={workspaceMutationAction} className="popover-form"><input type="hidden" name="libraryCode" value={libraryCode} /><input type="hidden" name="operation" value="shelf_save" />{shelf ? <input type="hidden" name="id" value={shelf.id} /> : null}<label>Shelf name<input name="name" defaultValue={shelf?.display_name} required maxLength={160} placeholder="Physics" /></label><label>Shelf code / number<input name="code" defaultValue={shelf?.location_code} required maxLength={80} placeholder="S-11" /></label><label>Status<select name="status" defaultValue={shelf?.status ?? "active"}><option value="active">Active</option><option value="inactive">Inactive</option></select></label><MutationRequestId /><MutationSubmitButton idleLabel={shelf ? "Save shelf" : "Add shelf"} pendingLabel="Saving…" /></form>;
}
