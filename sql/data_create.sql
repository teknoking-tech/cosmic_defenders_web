DECLARE
    v_user_id NUMBER;
    v_profile_id NUMBER;
BEGIN
    -- Prosedürü çağırarak yeni bir kullanıcı ve profil ekleyelim
    add_user_and_profile(
        p_username => 'johndoe',
        p_password => 'password123',
        p_email => 'johndoe@example.com',
        p_role => 'player',
        p_nickname => 'John',
        p_avatar => 'avatar_url',
        p_user_id => v_user_id,
        p_profile_id => v_profile_id
    );
    
    -- İşlem sonrası dönen user_id ve profile_id'yi görüntüleyelim
    DBMS_OUTPUT.PUT_LINE('User ID: ' || v_user_id);
    DBMS_OUTPUT.PUT_LINE('Profile ID: ' || v_profile_id);
END;


DECLARE
    v_user_id NUMBER;
    v_profile_id NUMBER;
BEGIN
    FOR i IN 1..100 LOOP
        -- Her 100 iterasyonda kullanıcı ve profil ekleyelim
        add_user_and_profile(
            p_username => 'user' || i,
            p_password => 'password' || i,
            p_email => 'user' || i || '@example.com',
            p_role => 'player',
            p_nickname => 'Nick' || i,
            p_avatar => 'https://example.com/avatar' || i || '.png',
            p_user_id => v_user_id,
            p_profile_id => v_profile_id
        );
        
        -- İlgili profillere rastgele skor ekleyelim
        add_game_score_with_transaction(
            p_profile_id => v_profile_id,
            p_score => DBMS_RANDOM.VALUE(0, 100),
            p_game_duration => DBMS_RANDOM.VALUE(10, 120),
            p_enemies_defeated => DBMS_RANDOM.VALUE(0, 50),
            p_resources_collected => DBMS_RANDOM.VALUE(0, 100)
        );

        -- Token oluşturma işlemi
        create_token_and_decrease_count(
            p_user_id => v_user_id,
            p_token => 'token' || i,
            p_expires_at => SYSTIMESTAMP + INTERVAL '1' DAY
        );
    END LOOP;

    COMMIT;
END;







