
SET SQL_SAFE_UPDATES = 0;

insert into category values(null, 'Automotive', 'Automotive services');
insert into category values(null, 'Computer', 'Computer services');
insert into category values(null, 'Financial', 'Financial services');
insert into category values(null, 'Household', 'Household services');
insert into category values(null, 'Tutoring', 'Tutoring services');

insert into tag values ("Chinese");
insert into tag values ("Fast");
insert into tag values ("Good Service");
insert into tag values ("Available 24/7");

alter table service modify column title varchar(120) not null;
alter table user modify column pwd varchar(200) not null;
alter table user modify column birthday date;
/*
insert into service values(null, 'Professional eCommerce Android App Design and Development', 'video link', 'image link', 
	'We are a professional E-commerce web design team, offering custom graphic design, Magento e-commerce solutions, 
	responsive e-commerce design, SEO online marketing and more web services, to completely meet your business needs.
    Support and development for Magento Community. 
    Magento setup and installation. 
    Implementation of Magento templates. 
    Magento template customization', 
    'San Francisco', 'CA', 10, date(now()), 3);

insert into service values(null, 'Angel Investor needed for innovative product', 'video link', 'image link', 
	'OurCrowd is a world-leading equity based platform, built for accredited investors to provide venture capital funding for early-stage technology start ups. 
	Membership in the community is vetted and offered only to people who meet stringent accreditation criteria. ', 
    'San Francisco', 'CA', 10, date(now()), 3);

insert into service values(null, 'Toyota Master Technician', 'video link', 'image link', 
	'Toyota Master Technician provide car service ', 
    'San Francisco', 'CA', 10, date(now()), 1);*/


insert into favorite values (10,1);

