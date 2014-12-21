

/* 
Creates edges between given user and users whose phone number is in the given list.
Sets permission to friend, and dirty to true
*/
create or replace function phone(from_user int, phone_numbers varchar[])
	/*
	Use case:
	*/
	returns void as
		$func$
		begin
		/* 
		Get list of target users
		Concurrency: fine, i think
		*/
		with targets as (
			select user_id from bbz_users 
				where phone_number=any(phone_numbers) and user_id<>from_user
		)
		/* 
		Create edges to those users
			concurrency:
			if two users add each other's numbers at the same time, we need to ensure only one set of edges is added
		*/		
		insert into bbz_perms (me, them) 
		(
			select from_user me, user_id from targets
			where not exists (select 1 from bbz_perms as m where m.me=from_user and m.them=user_id)
			union all			
			select user_id, from_user me from targets
			where not exists (select 1 from bbz_perms as m where m.me=user_id and m.them=from_user)
		);

		/*
		Update permissions and dirty to these users
		concurrency is fine (check mvcc in postgresql manual)
		must do this here, because we need to update also the rows that existed already
		*/
		with targets as (
			select user_id from bbz_users 
				where phone_number=any(phone_numbers) and user_id<>from_user
		)
		update bbz_perms 
			set perm=2, perm_dirty_me=true, perm_dirty_them=true 
			where 
				me=from_user 
				and perm<2
				and exists (select 1 from targets where user_id=them);

		/*
		update bbz_permissions
		set permission=1, is_permission_dirty=false
		where me=from_user and exists (select 1 from (select * from targets) as t where user_id=them);
*/
		end;
		$func$
	language plpgsql;


