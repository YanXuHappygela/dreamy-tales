CREATE TABLE `community_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`authorName` varchar(80) NOT NULL DEFAULT 'Anonymous',
	`title` varchar(255) NOT NULL,
	`characterType` varchar(80) NOT NULL,
	`scenario` varchar(80) NOT NULL,
	`style` varchar(80) NOT NULL,
	`language` varchar(20) NOT NULL DEFAULT 'English',
	`lengthMinutes` int NOT NULL DEFAULT 5,
	`storyJson` json NOT NULL,
	`downloadCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `community_posts_id` PRIMARY KEY(`id`)
);
