-- 1. Kullanıcılar Tablosu (Bağımsız)
CREATE TABLE users (
    user_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR2(50) UNIQUE NOT NULL,
    password VARCHAR2(100) NOT NULL,
    email VARCHAR2(100) UNIQUE NOT NULL,
    role VARCHAR2(20) NOT NULL CHECK (role IN ('admin', 'player')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
);


-- 3. Oyuncu Profilleri Tablosu (users tablosuna bağımlı)
CREATE TABLE player_profiles (
    profile_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id NUMBER NOT NULL,
    nickname VARCHAR2(50) NOT NULL,
    avatar VARCHAR2(100),
    player_level NUMBER DEFAULT 1 NOT NULL,  -- level yerine player_level kullanıldı
    experience_points NUMBER DEFAULT 0,
    CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- 4. Gemiler Tablosu (Bağımsız)
CREATE TABLE spaceships (
    ship_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ship_name VARCHAR2(50) NOT NULL,
    ship_type VARCHAR2(30) NOT NULL,
    attack_power NUMBER DEFAULT 10,
    defense_power NUMBER DEFAULT 10,
    speed NUMBER DEFAULT 10
);

-- 5. Oyuncu Gemileri Tablosu (player_profiles ve spaceships tablolarına bağımlı)
CREATE TABLE player_ships (
    player_ship_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    profile_id NUMBER NOT NULL,
    ship_id NUMBER NOT NULL,
    ship_level NUMBER DEFAULT 1,
    ship_health NUMBER DEFAULT 100,
    CONSTRAINT fk_player_profile FOREIGN KEY (profile_id) REFERENCES player_profiles(profile_id),
    CONSTRAINT fk_ship FOREIGN KEY (ship_id) REFERENCES spaceships(ship_id)
);

-- 6. Oyun Skorları Tablosu (player_profiles tablosuna bağımlı)
CREATE TABLE game_scores (
    score_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    profile_id NUMBER NOT NULL,
    score NUMBER NOT NULL,
    game_duration NUMBER NOT NULL, -- saniye cinsinden
    enemies_defeated NUMBER DEFAULT 0,
    resources_collected NUMBER DEFAULT 0,
    game_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_score_profile FOREIGN KEY (profile_id) REFERENCES player_profiles(profile_id)
);

-- 7. Başarılar Tablosu (Bağımsız)
CREATE TABLE achievements (
    achievement_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    achievement_name VARCHAR2(100) NOT NULL,
    achievement_description VARCHAR2(500),
    points NUMBER DEFAULT 10
);

-- 8. Oyuncu Başarıları Tablosu (player_profiles ve achievements tablolarına bağımlı)
CREATE TABLE player_achievements (
    player_achievement_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    profile_id NUMBER NOT NULL,
    achievement_id NUMBER NOT NULL,
    unlocked_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_player_achievement FOREIGN KEY (profile_id) REFERENCES player_profiles(profile_id),
    CONSTRAINT fk_achievement FOREIGN KEY (achievement_id) REFERENCES achievements(achievement_id),
    CONSTRAINT unique_player_achievement UNIQUE (profile_id, achievement_id)
);
