-- V2__seed_menu.sql: Seed initial 6 canteen items with verified Unsplash images

INSERT INTO menu_items (name, description, category, price, image_url, available, created_at, updated_at)
VALUES
('Masala Dosa', 'Crispy golden fermented crepe filled with spiced potato masala, served with fresh coconut chutney and hot sambar.', 'Breakfast', 40.00, 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=800&auto=format&fit=crop&q=80', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Meals Thali', 'Complete South Indian meal with steamed ponni rice, sambar, rasam, kootu, curd, and crispy appalam.', 'Meals', 60.00, 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=800&auto=format&fit=crop&q=80', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Idli Vada', 'Two pillow-soft steamed rice cakes and one crispy golden medu vada accompanied by tempered chutneys and sambar.', 'Breakfast', 35.00, 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&auto=format&fit=crop&q=80', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Samosa', 'Flaky golden triangular pastry stuffed with cumin-tempered potatoes, sweet green peas, and whole spices.', 'Snacks', 20.00, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&auto=format&fit=crop&q=80', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Tea', 'Freshly boiled Assam tea leaves simmered with buffalo milk, crushed ginger root, and green cardamom.', 'Beverages', 10.00, 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&auto=format&fit=crop&q=80', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Coffee', 'Traditional decoction brewed from dark roasted chicory coffee beans, frothed vigorously with scalding whole milk.', 'Beverages', 15.00, 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
