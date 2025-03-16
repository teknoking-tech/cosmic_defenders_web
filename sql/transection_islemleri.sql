## Belirli Bir Skorun Üzerindeki Oyuncuları Listeleme
SELECT pp.nickname,
       u.email,
       gs.score,
       gs.game_date
FROM game_scores gs
JOIN player_profiles pp ON gs.profile_id = pp.profile_id
JOIN users u ON pp.user_id = u.user_id
WHERE gs.score > 10
ORDER BY gs.score DESC;



##En Yüksek Skorları Veren İlk 10 Oyuncuyu Listeleme

SELECT pp.nickname,
       gs.score,
       gs.game_date
FROM game_scores gs
JOIN player_profiles pp ON gs.profile_id = pp.profile_id
ORDER BY gs.score DESC
FETCH FIRST 10 ROWS ONLY;



##Oyuncuların Ortalama Skorlarını Hesaplama

SELECT pp.nickname,
       AVG(gs.score) AS avg_score
FROM game_scores gs
JOIN player_profiles pp ON gs.profile_id = pp.profile_id
GROUP BY pp.nickname
ORDER BY avg_score DESC;





##Oyuncuların Seviye ve Deneyim Puanlarına Göre Sıralanması
SELECT pp.nickname,
       pp.experience_points,
       pp.player_level
FROM player_profiles pp
ORDER BY pp.player_level DESC, pp.experience_points DESC;



##Ortalama Yenilen Düşman Sayısına Göre Oyuncu Sıralaması

SELECT pp.nickname,
       AVG(gs.enemies_defeated) AS avg_enemies_defeated
FROM game_scores gs
JOIN player_profiles pp ON gs.profile_id = pp.profile_id
GROUP BY pp.nickname
ORDER BY avg_enemies_defeated DESC;


##Her Kullanıcının En Son Oyun Tarihini Listeleme

SELECT u.username,
       pp.nickname,
       MAX(gs.game_date) AS last_game_date
FROM users u
JOIN player_profiles pp ON u.user_id = pp.user_id
JOIN game_scores gs ON pp.profile_id = gs.profile_id
GROUP BY u.username, pp.nickname
ORDER BY last_game_date DESC;


##tum kullanicilar

SELECT * FROM USERS u 




