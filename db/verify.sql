
/* verifies the user, preparing the verification to be read by the next user update 
	sets some verification fields to null, to prevent the verification happening twice (concurrency)
	*/
create type verify_return_type as (has_verified boolean, has_changed_phone_number boolean);
create or replace function verify(for_user int, now bigint, set_succeeded boolean)
	returns verify_return_type as 
	$func$
	declare
		userRow bbz_users%ROWTYPE;
	begin
		/* prevent others writing to user */
		select * into userRow from bbz_users where
			user_id=for_user and
			v_code_http=v_code_sms and
			abs(v_code_http_received_at-v_code_sms_received_at)<(1000*60*10) and
			sms_phone_number is not null
			for update;
		if found then
			if set_succeeded then
				update bbz_users set has_verification_succeeded=true where user_id=for_user;
			end if;
			if userRow.phone_number<>userRow.sms_phone_number then							
				update bbz_users 
					set
						is_verified=true,
						is_verified_timestamp=now,
						phone_number=sms_phone_number,
						phone_number_timestamp=now,
						v_code_http=null,
						v_code_sms=null
					where
						user_id=for_user;
				return (true,true);
			else
				update bbz_users 
					set
						is_verified=true,
						is_verified_timestamp=now,
						v_code_http=null,
						v_code_sms=null
					where
						user_id=for_user;
				return (true,false);
			end if;
		else
			return (false, false);
		end if;
	end
	$func$
	language plpgsql;