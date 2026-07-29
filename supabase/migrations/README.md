# GIEFA Supabase Migrations

Run migrations in filename order. New database changes should be added here
instead of editing the older root-level SQL helper scripts.

Recommended production flow:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

The older SQL files in the project root are kept as historical install and
hotfix references. Treat this folder as the source of truth going forward.
