import { spawnSync } from "node:child_process";

// Disposable local-only migration upgrade regression. Requires Docker, a
// running local Supabase stack, and psql on PATH. Never point this at hosted DB.
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { encoding: "utf8", shell: process.platform === "win32", stdio: ["pipe", "pipe", "pipe"], ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
};

const cli = ["supabase@2.112.0"];
const priorMigration = "20260807190030";
run("npx.cmd", [...cli, "db", "reset", "--local", "--version", priorMigration, "--no-seed", "--yes"]);
const status = run("npx.cmd", [...cli, "status", "-o", "env"]);
const dbUrl = status.match(/^DB_URL=(.*)$/m)?.[1]?.trim();
if (!dbUrl) throw new Error("Supabase status did not expose DB_URL; refusing to guess a database target.");

const fixtureSql = `
insert into public.profiles (id, display_name, status)
values ('71000000-0000-0000-0000-000000000001', 'UPGRADE TEST PROFILE', 'active');
insert into public.members (id, member_identifier, member_kind, display_name)
values ('72000000-0000-0000-0000-000000000001', 'UPGRADE-TEST-MEMBER', 'teacher', 'UPGRADE TEST MEMBER');
insert into public.books (id, title) values ('73000000-0000-0000-0000-000000000001', 'UPGRADE TEST BOOK');
insert into public.book_copies (id, book_id, accession_number)
values ('74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'UPGRADE-TEST-COPY');
insert into public.loans (id, member_id, book_copy_id, issued_at, due_at, returned_at, issued_by_profile_id, returned_by_profile_id, status)
values ('75000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', now() - interval '10 days', now() - interval '5 days', now() - interval '1 day', '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'returned');
insert into public.fines (id, loan_id, assessed_amount_minor, assessed_by_profile_id, reason)
values
  ('76000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 100, '71000000-0000-0000-0000-000000000001', 'Historical row one'),
  ('76000000-0000-0000-0000-000000000002', '75000000-0000-0000-0000-000000000001', 200, '71000000-0000-0000-0000-000000000001', 'Historical row two');
`;
run("psql", [dbUrl, "-v", "ON_ERROR_STOP=1"], { input: fixtureSql });
run("npx.cmd", [...cli, "db", "push", "--local", "--yes"]);

const assertionSql = `
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.fines where loan_id = '75000000-0000-0000-0000-000000000001' and fine_kind = 'legacy';
  if v_count <> 2 then raise exception 'expected two preserved legacy fines, got %', v_count; end if;
  insert into public.fines (loan_id, fine_kind, assessed_amount_minor, assessed_by_profile_id)
  values ('75000000-0000-0000-0000-000000000001', 'overdue', 300, '71000000-0000-0000-0000-000000000001');
  begin
    insert into public.fines (loan_id, fine_kind, assessed_amount_minor, assessed_by_profile_id)
    values ('75000000-0000-0000-0000-000000000001', 'overdue', 400, '71000000-0000-0000-0000-000000000001');
    raise exception 'second automated overdue fine was accepted';
  exception when unique_violation then null;
  end;
end $$;
select 'legacy fine upgrade regression passed' as result;
`;
run("psql", [dbUrl, "-v", "ON_ERROR_STOP=1"], { input: assertionSql });
console.log("Legacy-fines upgrade regression passed: duplicate historical rows preserved as legacy; automated overdue assessment remains unique.");
