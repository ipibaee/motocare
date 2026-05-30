-- MOTOCARE DATABASE SCHEMA
-- Create tables

-- 1. Profiles (linked to auth.users)
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text,
    avatar_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Vehicles
create table public.vehicles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    brand text,
    type text,
    year integer,
    plate_number text,
    current_odometer integer default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Components
create table public.components (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    vehicle_id uuid not null references public.vehicles(id) on delete cascade,
    name text not null,
    icon text default 'Wrench',
    interval_km integer not null,
    interval_month integer not null,
    last_service_date date not null,
    last_service_odometer integer not null,
    is_urgent boolean default false,
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Service Logs
create table public.service_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    vehicle_id uuid not null references public.vehicles(id) on delete cascade,
    service_date date not null,
    odometer integer not null,
    total_cost numeric default 0,
    notes text,
    receipt_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Service Log Items
create table public.service_log_items (
    id uuid primary key default gen_random_uuid(),
    service_log_id uuid not null references public.service_logs(id) on delete cascade,
    component_id uuid references public.components(id) on delete set null,
    component_name text not null,
    cost numeric default 0
);

-- 6. Shops
create table public.shops (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    address text,
    phone text,
    rating numeric,
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) on all tables
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.components enable row level security;
alter table public.service_logs enable row level security;
alter table public.service_log_items enable row level security;
alter table public.shops enable row level security;

-- Policies for Profiles
create policy "Allow users to read their own profile" on public.profiles
    for select using (auth.uid() = id);

create policy "Allow users to update their own profile" on public.profiles
    for update using (auth.uid() = id);

-- Policies for Vehicles
create policy "Allow users to manage their own vehicles" on public.vehicles
    for all using (auth.uid() = user_id);

-- Policies for Components
create policy "Allow users to manage their own components" on public.components
    for all using (auth.uid() = user_id);

-- Policies for Service Logs
create policy "Allow users to manage their own service logs" on public.service_logs
    for all using (auth.uid() = user_id);

-- Policies for Service Log Items
create policy "Allow users to manage their own service log items" on public.service_log_items
    for all using (
        exists (
            select 1 from public.service_logs
            where public.service_logs.id = public.service_log_items.service_log_id
            and public.service_logs.user_id = auth.uid()
        )
    );

-- Policies for Shops
create policy "Allow users to manage their own shops" on public.shops
    for all using (auth.uid() = user_id);

-- Trigger to automatically create a profile for new users
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, full_name, avatar_url)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'full_name', new.email),
        new.raw_user_meta_data->>'avatar_url'
    );
    return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
