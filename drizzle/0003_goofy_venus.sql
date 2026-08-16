CREATE TABLE `anonymous_story_usage` (
	`clientKey` varchar(64) NOT NULL,
	`date` varchar(10) NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `anonymous_story_usage_clientKey_date_pk` PRIMARY KEY(`clientKey`,`date`)
);
