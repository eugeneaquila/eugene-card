create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
 insert into public.profiles(id, username, role)
 values(
  new.id,
  coalesce(new.raw_user_meta_data->>'full_name', new.email),
  'collector'
 )
 on conflict(id) do nothing;
 return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();
