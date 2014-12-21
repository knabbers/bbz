/*
to be called when user changes phone number
reset connections to all friends
set their perm to 1 (=forgot phone number)
set my perm to 2 (=has phone number)
*/
create or replace function on_phone_changed(for_user int)
	returns void
	as
	$foo$
		begin
		UPDATE bbz_perms set perm=1, perm_dirty_me=true, perm_dirty_them=true where them=for_user;
        UPDATE bbz_perms set perm=2, perm_dirty_me=true, perm_dirty_them=true where perm>=2 and me=for_user;
		end
	$foo$
	language plpgsql;
