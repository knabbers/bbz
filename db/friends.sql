/*
returns all friends data (ignore permission filtering for now)
sets dirty to false for appropriate dirtys
does this using a lock (for update)
columns in order:
	me_perm	
	them_perm
	me_perm_dirty
	them_perm_dirty
	user_id
	phone_number
	is_verified
	last_online_at
	lat
	lon
	acc
	gps_fix_at
	last_online_at_timestamp
	phone_number_timestamp 
	is_verified_timestamp
	gps_timestamp 
*/
create or replace function friends(for_user int)
	returns table (me_perm int, them_perm int, me_perm_dirty boolean, them_perm_dirty boolean, 
				   user_id int, phone_number varchar(16), is_verified boolean, last_online_at bigint,
				   lat real, lon real, acc real, gps_fix_at bigint,
				   last_online_at_timestamp bigint, phone_number_timestamp bigint, is_verified_timestamp bigint, gps_timestamp bigint)
	as
	$foo$
		begin
		return query
		with 
		old_me_perms as (
			update bbz_perms x set perm_dirty_me=false 
			from (
				select me, them, perm, perm_dirty_me
				from bbz_perms
				where me=for_user
				for update
				) y
			where (x.me,x.them)=(y.me,y.them)
			returning y.them as them, y.perm as me_perm, y.perm_dirty_me as me_perm_dirty
			),
		old_them_perms as (
			update bbz_perms x set perm_dirty_them=false 
			from (
				select me, them, perm, perm_dirty_them
				from bbz_perms
				where them=for_user
				for update
				) y
			where (x.me,x.them)=(y.me,y.them)
			returning y.me as me, y.perm as them_perm, y.perm_dirty_them as them_perm_dirty
			)
		select t.me_perm, t.them_perm, t.me_perm_dirty, t.them_perm_dirty, 
				   t.user_id, t.phone_number, t.is_verified, t.last_online_at,
				   t.lat, t.lon, t.acc, t.gps_fix_at bint,
				   t.last_online_at_timestamp, t.phone_number_timestamp, t.is_verified_timestamp, t.gps_timestamp from				
		(old_me_perms
		join 
		old_them_perms on me=them
		join
		bbz_users m on m.user_id=me) as t;

		end
	$foo$
	language plpgsql;
