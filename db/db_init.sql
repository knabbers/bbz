drop table bbz_users;
drop table bbz_permissions;

create table bbz_users(
	user_id serial,
	password varchar(16),

	phone_number varchar(16),
	is_verified boolean,
	last_online_at bigint,

	lat real,
	lon real,
	acc real,
	gps_fix_at bigint,

	v_code_http int,
	v_code_http_received_at bigint,
	v_code_sms int,
	v_code_sms_received_at bigint,
	sms_phone_number varchar(16),
	has_verification_succeeded boolean,

	last_online_at_timestamp bigint default -1,
	phone_number_timestamp bigint default -1,
	is_verified_timestamp bigint default -1,
	gps_timestamp bigint default -1,

	last_update_timestamp bigint default -1,

	primary key (user_id)
);

create index index_users_phone_number on bbz_users (phone_number);


create table bbz_perms(
	me int, /* the user whose permission this is with respect to */
	them int, /* the target user */

	/* permission: (only allowed to progress upwards one 'status' step at a time)
	 * 0	not friends (never been)
	 * 1 	not friends (moved down - i.e. phone number forgotten/changed)
	 * 2	friends (moved up - i.e. phone number match)
	 * 3 	friends (moved down - i.e. blocked)
	 * 4 	tracking
	 */
	perm int default 0 /*check(permission between 0 and 4)*/,
	perm_dirty_me boolean default false,
	perm_dirty_them boolean default false,

	primary key (me, them) /*,
	foreign key (me) references bbz_users(user_id),
	foreign key (them) references bbz_users(user_id)*/
);

create index index_perms_me on bbz_perms (me);
create index index_perms_them on bbz_perms (them);
cluster bbz_perms using index_perms_me;





/*
create table bbz_edges(
	user1_id int,
	user1_permission int default 0,

	user2_id int,	
	user2_permission int default 0,

	user1_permission_timestamp bigint default -1,
	user2_permission_timestamp bigint default -1,

	last_not_friends_timestamp bigint default -1,
	last_friends_timestamp bigint default -1,
	last_tracking_timestamp bigint default -1,

	primary key (user1_id)
);
*/