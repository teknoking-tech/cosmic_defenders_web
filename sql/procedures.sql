CREATE OR REPLACE PROCEDURE add_user_and_profile(
    p_username IN VARCHAR2,
    p_password IN VARCHAR2,
    p_email IN VARCHAR2,
    p_role IN VARCHAR2,
    p_nickname IN VARCHAR2,
    p_avatar IN VARCHAR2,
    p_user_id OUT NUMBER,
    p_profile_id OUT NUMBER
)
IS
    v_count NUMBER;
BEGIN
    -- Kullanıcı adı kontrolü
    SELECT COUNT(*) INTO v_count
    FROM users
    WHERE username = p_username OR email = p_email;
    
    IF v_count > 0 THEN
        RAISE_APPLICATION_ERROR(-20001, 'User with this username or email already exists.');
    END IF;

    -- Transaction başlatıldı
    SAVEPOINT start_transaction;

    -- Kullanıcıyı ekleyelim
    INSERT INTO users (username, password, email, role)
    VALUES (p_username, p_password, p_email, p_role)
    RETURNING user_id INTO p_user_id;

    -- Profil oluşturma
    INSERT INTO player_profiles (user_id, nickname, avatar, experience_points, player_level)
    VALUES (p_user_id, p_nickname, p_avatar, 0, 1) -- Başlangıç deneyim ve seviye
    RETURNING profile_id INTO p_profile_id;

    -- Eğer her şey başarılıysa commit yapalım
    COMMIT;

EXCEPTION
    WHEN OTHERS THEN
        -- Eğer hata oluşursa, tüm işlemleri geri al
        ROLLBACK TO start_transaction;
        RAISE_APPLICATION_ERROR(-20002, 'Error during user and profile creation: ' || SQLERRM);
END add_user_and_profile;




CREATE OR REPLACE PROCEDURE add_game_score_with_transaction(
    p_profile_id IN NUMBER,
    p_score IN NUMBER,
    p_game_duration IN NUMBER,
    p_enemies_defeated IN NUMBER,
    p_resources_collected IN NUMBER
)
IS
    v_count NUMBER;
    v_experience_points NUMBER;
BEGIN
    -- Profil varlığını kontrol et
    SELECT COUNT(*) INTO v_count
    FROM player_profiles
    WHERE profile_id = p_profile_id;
    
    IF v_count = 0 THEN
        RAISE_APPLICATION_ERROR(-20003, 'Profile not found.');
    END IF;

    -- Transaction başlatıldı
    SAVEPOINT start_transaction;

    -- Skor ekleme
    INSERT INTO game_scores (profile_id, score, game_duration, enemies_defeated, resources_collected, game_date)
    VALUES (p_profile_id, p_score, p_game_duration, p_enemies_defeated, p_resources_collected, SYSDATE);

    -- Deneyim puanlarını güncelle
    UPDATE player_profiles
    SET experience_points = experience_points + ROUND(p_score / 10)
    WHERE profile_id = p_profile_id;

    -- Deneyim puanlarını alalım
    SELECT experience_points INTO v_experience_points
    FROM player_profiles
    WHERE profile_id = p_profile_id;

    -- Deneyim puanları negatif olamaz
    IF v_experience_points < 0 THEN
        RAISE_APPLICATION_ERROR(-20005, 'Experience points cannot be negative.');
    END IF;

    -- Seviye kontrolü (Experience points'e göre seviyeyi güncelle)
    UPDATE player_profiles
    SET player_level = FLOOR(SQRT(experience_points) / 10) + 1
    WHERE profile_id = p_profile_id;

    -- Eğer her şey başarılıysa commit yapalım
    COMMIT;

EXCEPTION
    WHEN OTHERS THEN
        -- Eğer hata oluşursa, tüm işlemleri geri al
        ROLLBACK TO start_transaction;
        RAISE_APPLICATION_ERROR(-20004, 'Error during game score insertion: ' || SQLERRM);
END add_game_score_with_transaction;






CREATE OR REPLACE PROCEDURE update_user_and_profile(
    p_user_id IN NUMBER,
    p_username IN VARCHAR2,
    p_email IN VARCHAR2,
    p_role IN VARCHAR2,
    p_nickname IN VARCHAR2,
    p_avatar IN VARCHAR2
)
IS
    v_count NUMBER;
BEGIN
    -- Kullanıcı adı kontrolü (varsa)
    SELECT COUNT(*) INTO v_count
    FROM users
    WHERE (username = p_username OR email = p_email) AND user_id != p_user_id;
    
    IF v_count > 0 THEN
        RAISE_APPLICATION_ERROR(-20001, 'User with this username or email already exists.');
    END IF;

    -- Transaction başlatıldı
    SAVEPOINT start_transaction;

    -- Kullanıcıyı güncelle
    UPDATE users
    SET username = p_username,
        email = p_email,
        role = p_role
    WHERE user_id = p_user_id;

    -- Profil güncelleme
    UPDATE player_profiles
    SET nickname = p_nickname,
        avatar = p_avatar
    WHERE user_id = p_user_id;

    -- Eğer her şey başarılıysa commit yapalım
    COMMIT;

EXCEPTION
    WHEN OTHERS THEN
        -- Eğer hata oluşursa, tüm işlemleri geri al
        ROLLBACK TO start_transaction;
        RAISE_APPLICATION_ERROR(-20002, 'Error during user and profile update: ' || SQLERRM);
END update_user_and_profile;
















