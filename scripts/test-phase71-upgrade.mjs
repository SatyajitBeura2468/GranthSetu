import { spawnSync } from "node:child_process";

// Disposable local-only regression for a reachable pre-Phase-7.1 state.
// Never point this at hosted Supabase or real school data.
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { encoding: "utf8", shell: process.platform === "win32", stdio: ["pipe", "pipe", "pipe"], ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
};

const supabaseCommand = process.platform === "win32" ? "npx.cmd" : "supabase";
const cli = process.platform === "win32" ? ["supabase@2.112.0"] : [];
const beforePhase71 = "20260808120000";
run(supabaseCommand, [...cli, "db", "reset", "--local", "--version", beforePhase71, "--no-seed", "--yes"]);
const status = run(supabaseCommand, [...cli, "status", "-o", "env"]);
const dbUrl = status.match(/^DB_URL=(.*)$/m)?.[1]?.trim();
if (!dbUrl) throw new Error("Supabase status did not expose DB_URL; refusing to guess a database target.");
const databaseUrl = new URL(dbUrl.replace(/^['"]|['"]$/g, ""));
const psqlArgs = ["-h", databaseUrl.hostname, "-p", databaseUrl.port, "-U", decodeURIComponent(databaseUrl.username), "-d", databaseUrl.pathname.replace(/^\//, "")];
const psqlOptions = { env: { ...process.env, PGPASSWORD: decodeURIComponent(databaseUrl.password) } };

const fixtureSql = `
-- The historical repository schema did not yet declare roll_number. This
-- nullable legacy column models a deployed pre-Phase-7.1 database that had
-- already collected roll metadata without the new active-row invariant.
alter table public.student_enrollments add column if not exists roll_number text;
insert into public.members(id, member_identifier, member_kind, display_name, status)
values ('91000000-0000-0000-0000-000000000001', 'PHASE71-UPGRADE-MEMBER', 'student', 'Phase 7.1 Upgrade Student', 'active');
insert into public.academic_sessions(id, session_code, display_label, starts_on, ends_on, status)
values
  ('92000000-0000-0000-0000-000000000001', 'UPGRADE-2025', 'Academic 2025-26', '2025-04-01', '2026-03-31', 'closed'),
  ('92000000-0000-0000-0000-000000000002', 'UPGRADE-2026', 'Academic 2026-27', '2026-04-01', '2027-03-31', 'active'),
  ('92000000-0000-0000-0000-000000000003', 'UPGRADE-2027', 'Academic 2027-28', '2027-04-01', '2028-03-31', 'planned');
insert into public.grade_levels(id, grade_code, display_name, sort_order)
values
  ('93000000-0000-0000-0000-000000000001', 'UPGRADE-G5', 'Grade 5', 5),
  ('93000000-0000-0000-0000-000000000002', 'UPGRADE-G6', 'Grade 6', 6),
  ('93000000-0000-0000-0000-000000000003', 'UPGRADE-G7', 'Grade 7', 7);
insert into public.sections(id, section_code, display_name, sort_order)
values
  ('94000000-0000-0000-0000-000000000001', 'UPGRADE-A', 'Section A', 1),
  ('94000000-0000-0000-0000-000000000002', 'UPGRADE-B', 'Section B', 2),
  ('94000000-0000-0000-0000-000000000003', 'UPGRADE-C', 'Section C', 3);
insert into public.student_enrollments(id, member_id, academic_session_id, grade_level_id, section_id, roll_number, status, created_at)
values
  ('95000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', 'OLD-17', 'active', '2025-04-02T09:00:00Z'),
  ('95000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000002', '93000000-0000-0000-0000-000000000002', '94000000-0000-0000-0000-000000000002', 'CURRENT-18', 'active', '2026-04-02T09:00:00Z');
`;
run("psql", [...psqlArgs, "-v", "ON_ERROR_STOP=1"], { input: fixtureSql, ...psqlOptions });
run(supabaseCommand, [...cli, "db", "push", "--local", "--yes"]);

const assertionSql = `
do $$
declare
  v_total integer;
  v_active integer;
  v_status text;
  v_grade uuid;
  v_section uuid;
  v_roll text;
begin
  select count(*) into v_total from public.student_enrollments where member_id = '91000000-0000-0000-0000-000000000001';
  if v_total <> 2 then raise exception 'enrollment history was deleted, expected 2 rows, got %', v_total; end if;
  select count(*) into v_active from public.student_enrollments where member_id = '91000000-0000-0000-0000-000000000001' and status = 'active';
  if v_active <> 1 then raise exception 'expected exactly one active enrollment, got %', v_active; end if;
  select status, grade_level_id, section_id, roll_number into v_status, v_grade, v_section, v_roll from public.student_enrollments where id = '95000000-0000-0000-0000-000000000001';
  if v_status <> 'completed' or v_grade <> '93000000-0000-0000-0000-000000000001' or v_section <> '94000000-0000-0000-0000-000000000001' or v_roll <> 'OLD-17' then raise exception 'older enrollment history was not preserved'; end if;
  select status, grade_level_id, section_id, roll_number into v_status, v_grade, v_section, v_roll from public.student_enrollments where id = '95000000-0000-0000-0000-000000000002';
  if v_status <> 'active' or v_grade <> '93000000-0000-0000-0000-000000000002' or v_section <> '94000000-0000-0000-0000-000000000002' or v_roll <> 'CURRENT-18' then raise exception 'newest enrollment did not remain active with its original data'; end if;
  begin
    insert into public.student_enrollments(id, member_id, academic_session_id, grade_level_id, section_id, roll_number, status)
    values ('95000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000003', '93000000-0000-0000-0000-000000000003', '94000000-0000-0000-0000-000000000003', 'NEW-19', 'active');
    raise exception 'second simultaneous active enrollment was accepted';
  exception when unique_violation then null;
  end;
end $$;
select 'Phase 7.1 multi-active-enrollment upgrade regression passed' as result;
`;
run("psql", [...psqlArgs, "-v", "ON_ERROR_STOP=1"], { input: assertionSql, ...psqlOptions });
console.log("Phase 7.1 upgrade regression passed: duplicate active rows reconciled deterministically, both histories preserved, and the new invariant rejects a third active row.");
