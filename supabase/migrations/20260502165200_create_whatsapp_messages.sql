create table if not exists public.whatsapp_messages (
    id uuid default gen_random_uuid() primary key,
    wati_message_id text,
    lead_id uuid references public.leads(id) on delete cascade,
    sender_name text,
    wa_id text not null,
    message_text text,
    message_type text,
    direction text not null check (direction in ('inbound', 'outbound')),
    status text,
    operator_name text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.whatsapp_messages enable row level security;

-- Policies
create policy "Enable read access for authenticated users"
    on public.whatsapp_messages for select
    to authenticated
    using (true);

create policy "Enable insert access for authenticated users"
    on public.whatsapp_messages for insert
    to authenticated
    with check (true);

create policy "Enable update access for authenticated users"
    on public.whatsapp_messages for update
    to authenticated
    using (true);

create policy "Enable delete access for authenticated users"
    on public.whatsapp_messages for delete
    to authenticated
    using (true);

-- Function to update updated_at timestamp
create trigger update_whatsapp_messages_updated_at
    before update on public.whatsapp_messages
    for each row
    execute function update_updated_at_column();
