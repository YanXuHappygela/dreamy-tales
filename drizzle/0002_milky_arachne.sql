CREATE TABLE `story_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `story_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `community_posts` ADD `likeCount` int DEFAULT 0 NOT NULL;