DROP TABLE IF EXISTS `service_tag`;
DROP TABLE IF EXISTS `request_tag`;
DROP TABLE IF EXISTS `tag`;
DROP TABLE IF EXISTS `favorite`;
DROP TABLE IF EXISTS `review`;
DROP TABLE IF EXISTS `service`;
DROP TABLE IF EXISTS `request`;
DROP TABLE IF EXISTS `category`;
DROP TABLE IF EXISTS `user`;


CREATE TABLE `user` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT,
  `fname` varchar(45) DEFAULT NULL,
  `lname` varchar(45) DEFAULT NULL,
  `email` varchar(45) NOT NULL,
  `pwd` varchar(200) NOT NULL,
  `gender` varchar(10) DEFAULT NULL,
  `birthday` date DEFAULT NULL,
  `phone` varchar(45) DEFAULT NULL,
  `street` varchar(100) DEFAULT NULL,
  `city` varchar(45) DEFAULT NULL,
  `state` varchar(45) DEFAULT NULL,
  `zip_code` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email_UNIQUE` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE `category` (
  `category_id` int(11) NOT NULL AUTO_INCREMENT,
  `category_name` varchar(45) NOT NULL,
  `description` varchar(1024) DEFAULT NULL,
  PRIMARY KEY (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;



CREATE TABLE `service` (
  `service_id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(120) NOT NULL,
  `video` varchar(45) DEFAULT NULL,
  `image` varchar(45) DEFAULT NULL,
  `description` varchar(1024) NOT NULL,
  `city` varchar(45) DEFAULT NULL,
  `state` varchar(45) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `time` datetime NOT NULL,
  `category_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`service_id`),
  KEY `f_user_idx` (`user_id`),
  KEY `f_service_category_idx` (`category_id`),
  CONSTRAINT `f_service_category` FOREIGN KEY (`category_id`) REFERENCES `category` (`category_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `f_service_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE `request` (
  `request_id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(45) NOT NULL,
  `city` varchar(45) DEFAULT NULL,
  `state` varchar(45) DEFAULT NULL,
  `description` varchar(1024) NOT NULL,
  `user_id` int(11) NOT NULL,
  `time` datetime NOT NULL,
  `category_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`request_id`),
  KEY `f_user_idx` (`user_id`),
  KEY `f_request_category_idx` (`category_id`),
  CONSTRAINT `f_request_category` FOREIGN KEY (`category_id`) REFERENCES `category` (`category_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `f_request_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE `tag` (
  `tag_name` varchar(45) NOT NULL,
  PRIMARY KEY (`tag_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;




CREATE TABLE `request_tag` (
  `request_id` int(11) NOT NULL,
  `tag_name` varchar(45) NOT NULL,
  PRIMARY KEY (`request_id`,`tag_name`),
  KEY `f_rt_tage_idx` (`tag_name`),
  CONSTRAINT `f_rt_request` FOREIGN KEY (`request_id`) REFERENCES `request` (`request_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `f_rt_tage` FOREIGN KEY (`tag_name`) REFERENCES `tag` (`tag_name`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;



CREATE TABLE `review` (
  `user_id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  `time` datetime DEFAULT NULL,
  `comment` varchar(1024) DEFAULT NULL,
  `rate` int(11) DEFAULT NULL,
  PRIMARY KEY (`user_id`,`service_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;



CREATE TABLE `service_tag` (
  `service_id` int(11) NOT NULL,
  `tag_name` varchar(45) NOT NULL,
  PRIMARY KEY (`service_id`,`tag_name`),
  KEY `f_st_tag_idx` (`tag_name`),
  CONSTRAINT `f_st_service` FOREIGN KEY (`service_id`) REFERENCES `service` (`service_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `f_st_tag` FOREIGN KEY (`tag_name`) REFERENCES `tag` (`tag_name`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;



CREATE TABLE `favorite` (
  `user_id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  PRIMARY KEY (`user_id`,`service_id`),
  KEY `f_favor_service_idx` (`service_id`),
  CONSTRAINT `f_favor_service` FOREIGN KEY (`service_id`) REFERENCES `service` (`service_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `f_favor_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;



ALTER TABLE user MODIFY COLUMN `gender` varchar(10);