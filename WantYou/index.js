'use strict';

var express = require('express');
var fs = require('fs');
var session = require('express-session');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var app = express();
var http = require('http');
var async = require("async");
var request = require("request");
var moment = require('moment');
var mysql = require("mysql");
var winston = require('winston');
var grid = require('gridfs-stream');
var mongoose = require('mongoose');
var uri = 'mongodb://localhost:27017/wantyou';
//var uri = 'mongodb://localhost:49890/wantyou';

var pool = mysql.createPool({
  host:'localhost',
  user:'root',
  password:'',
  database:'wantYou'
});
var passwordHash = require('password-hash');
var dateTimeFormat = 'YYYY-MM-DD HH:mm:ss';
var dateFormat = 'YYYY-MM-DD';

var logger = new (winston.Logger)({
  transports: [ 
    new (winston.transports.Console)(),
    new (winston.transports.File)({ filename: 'logfile.log' })
  ]
});

//Open mysql connection
pool.getConnection(function(err){
  if(!err) {
    logger.info("Database is connected ... ");    
  } else {
    logger.warn(err)
    logger.warn("Error connecting database ... ");    
  }
});


mongoose.createConnection(uri, function (err, db) {
  if (err) {
    console.log('Unable to connect to mongodb: ', err);
  } else {
    console.log('mongo connected to: ', uri);
  }
});
var imageSchema = mongoose.Schema;
var mongoConn = mongoose.connection;
console.log('mongo conn', mongoConn)
grid.mongo = mongoose.mongo;

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.engine('.html', require('ejs').__express);
app.set('view engine', 'html');

// for parsing application/json
app.use(bodyParser.json()); 
// for parsing application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true })); 
// for session access
app.use(cookieParser());
app.use(session({
	secret : 'CMPE226_secret_key',
	cookie : {/*secure : true*/}
}));

app.post('/upload', function (req, res) {
  var imagePath = req.body.path;
  imagePath = imagePath.replace("fakepath", "CMPE226");
  console.log(imagePath);
  mongoConn.once('open', function () {
    console.log('open');
    var gfs = grid(conn.db);

    var writestream = gfs.createWriteStream({
      filename : 'test.jpg'
    });
    fs.createReadStream(imagePath).pipe(writestream);
    writestream.on('close', function (file) {
      console.log('upload to db');
    });
  });
});

// index.html
app.get('/', function(req, res) {
  logger.info('rendering index page');

  if (req.session.user) {
    console.log('in index: ', req.session.user);
    res.render('pages/index', {MemberInfo : req.session.user});
  } else {
    res.render('pages/index');
  }
  
});

app.get('/login', function (req, res) {
  logger.info('rendering login page');
  res.render('pages/login');
});

app.post('/login', function (req, res) {
  // get data from page's request
  var loginData = req.body;
  logger.info('login process');
  if (req.body.email == 'admin') {
    var adminHashed = passwordHash.generate('admin');
    if (passwordHash.verify(req.body.password, adminHashed)) {
      //console.log('123')
      logger.info('admin logged in');
      res.json({result : true, msg : 'admin'});
      return;
    }
  }

  var query = "select user_id, fname, pwd, city from user where email='" + loginData.email + "';";
  //console.log(query);
  pool.getConnection(function (err, connection) {
    connection.query(query, function (err, rows) {
      connection.release();
      if (!err) {

        //console.log(rows);
        if (rows.length > 0) {        
          var dbpwd = rows[0].pwd;
          if (passwordHash.verify(req.body.password, dbpwd)) {
            req.session.user = {
              userId : rows[0].user_id,
              fname : rows[0].fname,
              city: rows[0].city
            };
            //logger.info('common user logged in');
            console.log('session after logged in: ', req.session.user)
            res.json({result : true, msg : req.session.user});
          } else {
            logger.warning('wrong password');
            res.json({result : false, msg : "wrong password"});
          }
        } else {
          logger.warning('wrong email');
          res.json({result : false, msg : "wrong email"});
        }

      } else {
        logger.warning('Error is : ', err);
        console.log('Error is : ', err);
        res.json({result : false, msg : "login fail!"});
      }
    });
  });

});

app.get('/logout', function (req, res) {
  req.session.destroy(function (err) {
    if (err) {
      throw err;
    }
    logger.info('user logged out');
    res.redirect('/');
  });
})  


//======= Register ========
app.get('/register', function (req, res) {
  res.render('pages/register');
});

app.post('/register', function(req, res) {
  var data = req.body;
  // check data integrity
  if (data.fname == '' || data.lname == '' || data.email == '' 
    || data.pwd == '' || data.confpwd == '' || data.gender == '') {
    // if any required field is empty, return error to page
    return json_false(res, "Please input valid data");
  } else  if (!data.email.match(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/)) {
    // if email field does not match email format, return error to page
    return json_false(res, "Please input valid email");
  } else if (data.pwd != data.confpwd) {
    // if two passwords don't match, return error to page
    return json_false(res, "password don't match");
  } else {
    // confpwd doesn't exist in database, delete it before insert
    delete data.confpwd;


    data.pwd = passwordHash.generate(data.pwd);
    console.log(data.pwd);
    pool.getConnection(function (err, connection) {
      var query = connection.query('INSERT INTO user SET ?', data, function(err, result) {
        //
        connection.release();
        if (err) {
          console.log('db error is: ', err);
        } else {
          if (result.affectedRows == 1) {
            return json_true(res, "register done!");
          }
          console.log('result is: ', result.affectedRows);
        }
      });
      //console.log(query);
    });
  }
})

// updateProfile
app.get('/updateProfile', function(req,res){
  if(!req.session.user) {
    res.redirect("/login");
    return;
  }

  var query = "select * from user where user_id=" + req.session.user.userId + ";";
  pool.getConnection(function (err, connection) {
    if (!err) {
      connection.query(query, function (err, result) {
        connection.release();
        if (!err) {
          var userData = result[0];
          console.log('in render update', userData);
          if (userData.birthday != null) {
            userData.birthday = moment(userData.birthday).format(dateFormat)
          }
          //console.log('in edit user: ', userData);
          res.render('pages/updateProfile', {data:userData, MemberInfo:req.session.user})
        }
      });      
    } else {
      console.log('connection error while fetching user info: ', err);
    }
  });

});

app.post('/updateProfile', function (req, res) {
    var user = req.session.user;
    
    var data = req.body;
    
    var updateData = {
      fname: data.fname,
      lname:data.lname,
      gender:data.gender,
      birthday:moment(data.birthday).format(dateFormat),
      phone:data.phone,
      street:data.street,
      city:data.city,
      state:data.state,
      zip_code:data.zip_code,
    };
    // password will be added after
    if (data.pwd && data.pwd != '') {
      updateData.pwd = data.pwd;
      updateData.pwd = passwordHash.generate(updateData.pwd); // hash the password
      console.log('has password')
    }
    
    console.log('in update profile: ', updateData);
    pool.getConnection(function (err, connection) {
      var query = connection.query('update user set ? where user_id = ' + req.session.user.userId, updateData, function(err, result) {
        //
        connection.release();
        if (err) {
          console.log('db error is: ', err);
        } else {
          if (result.affectedRows == 1) {
            return json_true(res, "Update done!");
          } else {
            return json_false(res, "Unable to update!");
            console.log('result is: ', result.affectedRows);
          }
          
        }
      });
      //console.log(query);
    });

});

app.get('/manage_serv_req', function (req, res) {
  // get service
    var servQuery = "select service_id,title,s.description as description,city,state,user_id,time,category_name from service as s, category as c where s.category_id = c.category_id and user_id = " + req.session.user.userId +";";
    console.log(servQuery)
    pool.getConnection(function (err, connection) {
      var query = connection.query(servQuery, function(err, rows) {
        connection.release();
        if (err) {
          console.log('db error is: ', err);
        } else {
          var servInfo = [];
          if (rows.length > 0) {
            
            //console.log(rows);
            for (var i = 0; i < rows.length; i++) {
              servInfo.push({
                service_id: rows[i].service_id,
                title: rows[i].title,
                description: rows[i].description,
                city: rows[i].city,
                state: rows[i].state,
                time: moment(rows[i].time).format(dateTimeFormat), // change the date time to readable
                category_name: rows[i].category_name
              });

            }
          } 
          getReq(servInfo);
        }
      });
      //console.log(query);
    });

    var getReq = function (servInfo) {
      //SQL语句
      var reqQuery = "select request_id,title,r.description as description,city,state,user_id,time,category_name from request as r, category as c where r.category_id = c.category_id and user_id = " + req.session.user.userId +";";
      pool.getConnection(function (err, connection) {
        var query = connection.query(reqQuery, function(err, rows) {
          connection.release();
          if (err) {
            console.log('db error is: ', err);
          } else {
            var reqInfo = [];
            if (rows.length > 0) {
              console.log(rows)
              for (var i = 0; i < rows.length; i++) {
                reqInfo.push({
                  request_id: rows[i].request_id,
                  title: rows[i].title,
                  description: rows[i].description,
                  city: rows[i].city,
                  state: rows[i].state,
                  time: moment(rows[i].time).format(dateTimeFormat),
                  category_name: rows[i].category_name
                });
              }
            }
            res.render('pages/manage_serv_req', {services:servInfo, requests:reqInfo, MemberInfo:req.session.user});
            //console.log('result is: ');
          }
        });
        //console.log(query);
      });
    }
});

app.get('/recommend', function (req, res) {
  var queryReq = "select request_id, title, time, description from request where request_id in (select distinct(request_id) from request_tag where tag_name in ( select tag_name from service_tag where service_id in (select service_id from service where user_id =" + req.session.user.userId + ")))";
  var queryServ = "select service_id, title, time, description from service where service_id in (select distinct(service_id) from service_tag where tag_name in ( select tag_name from request_tag where request_id in (select request_id from request where user_id =" + req.session.user.userId + ")))";

  var reqData, servData;
  pool.getConnection(function (err, connection) {
    connection.query(queryReq, function (err, rows) {
      connection.release();
       if (!err) {
        var reqInfo = [];
        for (let i = 0; i < rows.length; i++) {
          reqInfo.push({
            request_id : rows[i].request_id,
            time : moment(rows[i].time).format(dateFormat),
            description : rows[i].description,
            title : rows[i].title
          });
        }
        
        getRequests(reqInfo);        
      } else {
        console.log('Error is : ', err);
        console.log('Error while performing Query.');
      }
    });
  });

  var getRequests = function (reqInfo) {
    pool.getConnection(function (err, connection) {
      connection.query(queryServ, function (err, rows) {
        connection.release();
         if (!err) {
          var servInfo = [];
          for (let i = 0; i < rows.length; i++) {
            servInfo.push({
              service_id : rows[i].service_id,
              time : moment(rows[i].time).format(dateFormat),
              description : rows[i].description,
              title : rows[i].title
            });
          }
          
          res.render('pages/recommend', {servs: servInfo, reqs: reqInfo, MemberInfo:req.session.user});
        } else {
          console.log('Error is : ', err);
          console.log('Error while performing Query.');
        }
      });
    });
  }

});

//service list

app.get('/serReqList/:city', function (req, res) {

  var cityName = req.params.city;
  console.log('in serreq, city is:' + cityName);
  var servQuery = "select service_id, time, category_name, title from service as s, category as c " 
  servQuery = servQuery + "where s.category_id = c.category_id and city ='" + cityName +"';";
  //console.log(query);      

  pool.getConnection(function (err, connection) {
    connection.query(servQuery, function (err, rows) {
      connection.release();
       if (!err) {
        var servInfo = [];
        for (let i = 0; i < rows.length; i++) {
          servInfo.push({
            service_id : rows[i].service_id,
            time : moment(rows[i].time).format(dateFormat),
            category_name : rows[i].category_name,
            title : rows[i].title
          });
        }
        console.log('in ser list: ', servInfo);
        // add session check
        getRequests(servInfo);        
      } else {
        console.log('Error is : ', err);
        console.log('Error while performing Query.');
      }
    });
  });

  var getRequests = function(servInfo) {
    var reqQuery = "select request_id, time, category_name, title from request as r, category as c where r.category_id = c.category_id and city ='" + cityName +"';"
    pool.getConnection(function (err, connection) {
      connection.query(reqQuery, function (err, rows) {
        connection.release();
         if (!err) {
          var reqInfo = [];
          for (let i = 0; i < rows.length; i++) {
            reqInfo.push({
              request_id : rows[i].request_id,
              time : moment(rows[i].time).format(dateFormat),
              category_name : rows[i].category_name,
              title : rows[i].title
            });
          }
          console.log('in req list: ', cityName);
          // add session check
          if (req.session.user) {
            res.render('pages/serReqList', {city: cityName, 'data': servInfo, 'reqs': reqInfo, 'MemberInfo': req.session.user});
          } else {
            res.render('pages/serReqList', {city: cityName, 'data': servInfo, 'reqs': reqInfo});
          }
          
        } else {
          console.log('Error is : ', err);
          console.log('Error while performing Query.');
        }
      });
    });
  }
});

// admin user list
app.get('/admin', function (req, res) {
  req.session.user = {fname:'admin', userId:'-1'};
  var query = "select * from user;" 
  //console.log(query);  

  pool.getConnection(function (err, connection) {
    connection.query(query, function (err, rows) {
      connection.release();
      
      var userInfo = [];
      for(let i = 0; i < rows.length; i++) {
        userInfo.push({
          user_id: rows[i].user_id,
          fname: rows[i].fname,
          lname: rows[i].lname,
          email: rows[i].email,
          pwd: rows[i].pwd,
          gender: rows[i].gender,
          birthday: rows[i].birthday,
          phone: rows[i].phone,
          street: rows[i].street,
          city: rows[i].city,
          state: rows[i].state,
          zip_code: rows[i].zip_code
        });
      }

      if (!err) {
        logger.info('in admin ', userInfo);
        getServInfo(userInfo);
        //res.render('pages/admin', {userData : userInfo});
      } else {
        logger.info('Error is : ', err);
        console.log('Error while performing Query.');
      }
    });
  });

  var getServInfo = function (userInfo) {
    var servInfo = [];
    var servQuery = "SELECT * FROM service";
    pool.getConnection(function (err, connection) {
      connection.query(servQuery, function (err, rows) {
        connection.release();
        console.log(rows);
        if (!err) {
          for (let i = 0; i < rows.length; i++) {
            servInfo.push({
              service_id: rows[i].service_id,
              title: rows[i].title,
              video: rows[i].video,
              image: rows[i].image,
              description: rows[i].description,
              city: rows[i].city,
              state: rows[i].state,
              user_id: rows[i].user_id,
              time: moment(rows[i].time).format(dateFormat),
              category_id: rows[i].category_id
            });
          }
          getReqInfo(userInfo, servInfo);
          //res.render('pages/admin', {userData : userInfo, servData : servInfo, MemberInfo : req.session.user});
        } else {
          console.log('Error is : ', err);
        }
      })
    });
  };

  var getReqInfo = function (userInfo, servInfo) {
    var reqInfo = [];
    var reqQuery = "SELECT * FROM request";
    pool.getConnection(function (err, connection) {
      connection.query(reqQuery, function (err, rows) {
        connection.release();
        console.log(rows);
        if (!err) {
          for (let i = 0; i < rows.length; i++) {
            reqInfo.push({
              request_id: rows[i].request_id,
              title: rows[i].title,
              video: rows[i].video,
              image: rows[i].image,
              description: rows[i].description,
              city: rows[i].city,
              state: rows[i].state,
              user_id: rows[i].user_id,
              time: moment(rows[i].time).format(dateFormat),
              category_id: rows[i].category_id
            });
          }
          getTagInfo(userInfo, servInfo, reqInfo);
          //res.render('pages/admin', {userData : userInfo, servData : servInfo, requestData:reqInfo, MemberInfo : req.session.user});
        } else {
          console.log('Error is : ', err);
        }
      })
    });
  };

  var getTagInfo = function (userInfo, servInfo, reqInfo) {
    var tagInfo = [];
    var tagQuery = "SELECT * FROM tag";
    pool.getConnection(function (err, connection) {
      connection.query(tagQuery, function (err, rows) {
        connection.release();
        
        if (!err) {
          for (let i = 0; i < rows.length; i++) {
            tagInfo.push({
              tag_name: rows[i].tag_name
            });
          }
          console.log('tag', tagInfo)
          getCateInfo(userInfo, servInfo, reqInfo, tagInfo);
          //res.render('pages/admin', {userData : userInfo, servData : servInfo, requestData:reqInfo, MemberInfo : req.session.user});
        } else {
          console.log('Error is : ', err);
        }
      })
    });   
  };

  var getCateInfo = function (userInfo, servInfo, reqInfo, tagInfo) {
    var cateInfo=[];
    var cateQuery = "SELECT * FROM category";
    pool.getConnection(function (err, connection) {
      connection.query(cateQuery, function (err, rows) {
        connection.release();
        
        if (!err) {
          for (let i = 0; i < rows.length; i++) {
            cateInfo.push({
              category_id:rows[i].category_id,
              category_name:rows[i].category_name,
              description:rows[i].description
            });
          }
          
          res.render('pages/admin', {userData : userInfo, servData : servInfo, requestData:reqInfo, tagData: tagInfo, cateData:cateInfo, MemberInfo : req.session.user});
        } else {
          console.log('Error is : ', err);
        }
      })
    }); 
  }
});

app.get('/edituser/:id', function (req, res) {
  //console.log('id: ',req.params.id)
  //res.render('pages/edituser')
  var query = "select * from user where user_id = " + req.params.id + ";";
  pool.getConnection(function (err, connection) {
    if (!err) {
      connection.query(query, function (err, result) {
        connection.release();
        if (!err) {
          //这里没有转换，因为只有一条数据，直接读取就可以了a
          var userData = result[0];
          console.log('in edit user: ', userData);
          res.render('pages/edituser', {data:userData})
        }
      });      
    } else {
      console.log('connection error while fetching user info: ', err);
    }

  });
});

app.post('/edituser', function (req, res) {
  //console.log(req.body)
  var userData = req.body;
  var query = pool.getConnection(function (err, connection) {
    if (!err) {
      connection.query('update user set ? where user_id = ' + req.body.user_id, userData, function (err, result) {
        connection.release();
        if (!err) {
          //console.log(result);
          if (result.affectedRows == 1) {
            json_true(res, "Update done!");
          } else {
            json_false(res, "Update fail!");
          }
        } else {
          console.log('Error: ', err);
          json_false(res, "Update fail!");
        }
      });
    } else {
      console.log('Connection Error: ', err);
      json_false(res, "Update fail!");
    }
  });
  console.log(query);
});

// call back hell, need to improve
app.post('/removeuser', function (req, res) {
  var user_id = req.body.user_id;
  pool.getConnection(function (err, connection) {
    connection.beginTransaction(function(err) {
      if (err) { throw err; }
      connection.query('delete from service where user_id = ' + user_id, function(err, result) {
        if (err) {
          return connection.rollback(function() {
            throw err;
          });
        }
        connection.query('delete from request where user_id = ' + user_id, function(err, result) {
          if (err) {
            return connection.rollback(function() {
              throw err;
            });
          }
          connection.query('delete from user where user_id = ' + user_id, function (err, result) {
            if (err) {
              return connection.rollback(function () {
                throw err;
              });
            }
            connection.commit(function(err) {
              if (err) {
                return connection.rollback(function() {
                  throw err;
                });
              } else {
                console.log('success!');
                connection.release();
                res.json({result : true, msg : "Delete Done!"});                
              }
            });
          });
        });
      });
    });
  });
});

app.post('/remove_serv_req', function (req, res) {
  var data = req.body;
  var query = "";
  if (data.type == "service") {
    query = "delete from service where service_id = " + data.id + ";";
  } else {
    query = "delete from request where request_id = " + data.id + ";";
  }
  console.log('in remove', query)
  pool.getConnection(function (err, connection) {
    connection.query(query, function (err, result) {
      connection.release();
      if (!err) {
        if (result.affectedRows == 1) {
          res.json({result : true, msg : "Delete Done!"});
        } else {
          res.json({result : false, msg : "Delete Fail!"});
        }
      } else {
        console.log(err);
        res.json({result : false, msg : "Delete Fail!"});
      }
    });
  });
});

app.post('/remove_req_serv_user', function (req, res) {
  var data = req.body;
  console.log(data);
  var request_id = 0, service_id = 0;
  var query = "delete from ";
  if (data.type == 'request') {
    request_id = data.id;
    query += "request where request_id = " + request_id;
  } else {
    service_id = data.id;
    query += "service where service_id = " + service_id;
  }
  console.log(query);
  pool.getConnection(function (err, connection) {
    connection.query(query, function (err, result) {
      connection.release();
      if (!err) {
        if (result.affectedRows == 1) {
          res.json({result : true, msg : "Delete Done!"});
        } else {
          res.json({result : false, msg : "Delete Fail!"});
        }
      } else {
        console.log(err);
        res.json({result : false, msg : "Delete Fail!"});
      }
    });
  });
});

app.post('/removetag', function (req, res) {
  var tag_name = req.body.id;
  console.log(tag_name);
  pool.getConnection(function (err, connection) {
    connection.beginTransaction(function(err) {
      if (err) { 
        console.log('in remove tag, before first query, error: ', err);
        throw err; 
      }
      connection.query("delete from request_tag where tag_name = '" + tag_name + "';", function(err, result) {
        if (err) {
          return connection.rollback(function() {
            throw err;
          });
        }
        connection.query("delete from service_tag where tag_name = '" + tag_name + "';", function(err, result) {
          if (err) {
            return connection.rollback(function() {
              throw err;
            });
          }
          connection.query("delete from tag where tag_name = '" + tag_name + "';", function (err, result) {
            if (err) {
              return connection.rollback(function () {
                throw err;
              });
            }
            connection.commit(function(err) {
              if (err) {
                return connection.rollback(function() {
                  throw err;
                });
              } else {
                console.log('success!');
                connection.release();
                res.json({result : true, msg : "Delete Done!"});                
              }
            }); // end of commit function
          }); // end of delete tag
        }); // end of delete service_tag
      }); // end of delete request_tag
    }); // end of transaction
  });
});

app.post('/removecategory', function (req, res) {
  var category_id = req.body.category_id;
  //console.log(tag_name)
  pool.getConnection(function (err, connection) {
    connection.beginTransaction(function(err) {
      if (err) { throw err; }
      connection.query("delete from category where category_id = " + category_id + ";", function(err, result) {
        if (err) {
          return connection.rollback(function() {
            throw err;
          });
        }
        connection.query("update service set category_id = null where category_id = " + category_id + ";", function(err, result) {
          if (err) {
            return connection.rollback(function() {
              throw err;
            });
          }
          connection.query("update request set category_id = null where category_id = " + category_id + ";", function (err, result) {
            if (err) {
              return connection.rollback(function () {
                throw err;
              });
            }
            connection.commit(function(err) {
              if (err) {
                return connection.rollback(function() {
                  throw err;
                });
              } else {
                console.log('success!');
                connection.release();
                res.json({result : true, msg : "Delete Done!"});                
              }
            }); // end of commit function
          }); // end of delete cate
        }); // end of update service
      }); // end of update request
    }); // end of transaction
  });
});

app.post('/createtag', function (req, res) {
  var tag_name = req.body.tag_name;
  var data = {tag_name: tag_name};
  pool.getConnection(function (err, connection) {
      var query = connection.query('INSERT INTO tag SET ?', data, function(err, result) {
        //
        connection.release();
        if (err) {
          console.log('db error is: ', err);
          res.json({result : false, msg : err});
        } else {
          if (result.affectedRows == 1) {
            res.json({result : true, msg : "Create Tag Done!"});
          } else {
            res.json({result : false, msg : "Create Tag Fail!"});
          }
          //console.log('result is: ', result.affectedRows);
        }
      });
      //console.log(query);
  });
});

app.post('/createcategory', function (req, res) {

  pool.getConnection(function (err, connection) {
      var query = connection.query('INSERT INTO category SET ?', req.body, function(err, result) {
        //
        connection.release();
        if (err) {
          console.log('db error is: ', err);
          res.json({result : false, msg : err});
        } else {
          if (result.affectedRows == 1) {
            res.json({result : true, msg : "Create category Done!"});
          } else {
            res.json({result : false, msg : "Create category Fail!"});
          }
          //console.log('result is: ', result.affectedRows);
        }
      });
      //console.log(query);
  });
});

app.get('/edit_serv/:id', function (req, res) {

  var service_id = req.params.id;
  var query = "select s.service_id, title, s.description, city, state, time, category_name from service as s, category as c where s.category_id = c.category_id and service_id = " + service_id + ";";
  pool.getConnection(function (err, connection) {
    if (!err) {
      connection.query(query, function (err, result) {
        connection.release();
        if (!err) {
          var servData = {
            service_id:result[0].service_id,
            title: result[0].title,
            description:result[0].description,
            city:result[0].city,
            state:result[0].state,
            time:moment(result[0].time).format(dateTimeFormat),
            category_name:result[0].category_name
          };
          //console.log('in edit serv: ', servData);
          res.render('pages/edit_serv', {data:servData, MemberInfo:req.session.user})
        }
      });      
    } else {
      console.log('connection error while fetching user info: ', err);
    }

  });
});

app.get('/edit_req/:id', function (req, res) {

  var request_id = req.params.id;
  
  
  var query = "select r.request_id, title, r.description, city, state, time, category_name from request as r, category as c where r.category_id = c.category_id and request_id = " + request_id + ";";
  console.log('in edit req: ',query);
  pool.getConnection(function (err, connection) {
    if (!err) {
      connection.query(query, function (err, result) {
        connection.release();
        if (!err) {
          var reqData = {
            request_id:result[0].request_id,
            title: result[0].title,
            description:result[0].description,
            city:result[0].city,
            state:result[0].state,
            time:moment(result[0].time).format(dateTimeFormat),
            category_name:result[0].category_name
          };
          console.log('in edit req: ', reqData);
          res.render('pages/edit_req', {data:reqData, MemberInfo:req.session.user})
        }
      });      
    } else {
      console.log('connection error while fetching user info: ', err);
    }

  });
});

app.post('/edit_serv', function (req, res) {
  var servInfo = {
    title: req.body.title,
    description: req.body.description
  }

  console.log('in post edit serv', servInfo);
  var query = pool.getConnection(function (err, connection) {
    if (!err) {
      connection.query('update service set ? where service_id = ' + req.body.service_id, servInfo, function (err, result) {
        connection.release();
        if (!err) {
          //console.log(result);
          if (result.affectedRows == 1) {
            json_true(res, "Update done!");
          } else {
            json_false(res, "Update fail!");
          }
        } else {
          console.log('Error: ', err);
          json_false(res, "Update fail!");
        }
      });
    } else {
      console.log('Connection Error: ', err);
      json_false(res, "Update fail!");
    }
  });
})

app.post('/edit_req', function (req, res) {
  var reqInfo = {
    title: req.body.title,
    description: req.body.description
  }

  console.log('in post edit req', reqInfo);
  var query = pool.getConnection(function (err, connection) {
    if (!err) {
      connection.query('update request set ? where request_id = ' + req.body.request_id, reqInfo, function (err, result) {
        connection.release();
        if (!err) {
          //console.log(result);
          if (result.affectedRows == 1) {
            json_true(res, "Update done!");
          } else {
            json_false(res, "Update fail!");
          }
        } else {
          console.log('Error: ', err);
          json_false(res, "Update fail!");
        }
      });
    } else {
      console.log('Connection Error: ', err);
      json_false(res, "Update fail!");
    }
  });
});

//======= Create Service ========
app.get('/service_create', function (req, res) {
  var renderPage = function (cdata, tdata) {
    if (req.session.user) {
      res.render('pages/service_create', {cateData: cdata, tagData:tdata, MemberInfo:req.session.user});
    } else {
      res.redirect('/login');
    }
  };

  var getTags = function (cdata) {
    pool.getConnection(function (err, connection) {
      connection.query('SELECT * FROM tag;', function(err, rows) {
        connection.release();
        if (err) {
          console.log('db error is: ', err);

        } else {          
          var tdata = [];
          for(let i = 0; i < rows.length; i++) {
            tdata.push({
              tag_name: rows[i].tag_name
            });
          }
          //console.log('data: ', data)
          renderPage(cdata, tdata);
        }
      });
    });
  };
  pool.getConnection(function (err, connection) {
    connection.query('SELECT * FROM category;', function(err, rows) {
      connection.release();
      if (err) {
        console.log('db error is: ', err);

      } else {          
        var cdata = [];
        for(let i = 0; i < rows.length; i++) {
          cdata.push({
            category_id: rows[i].category_id,
            category_name: rows[i].category_name
          });
        }
        console.log('data: ', cdata)
        getTags(cdata);
      }
    });
  });
});

app.post('/service_create', function (req, res) {
  var data = req.body;
  var today = new Date();
  var currentTime = today.getFullYear() + '-' + (today.getMonth()+1) + '-' + today.getDate() + ' ' + today.getHours() + ':' + today.getMinutes() + ':' + today.getSeconds();
  var category_id = 0;
  if (data.title == '' || data.description == '') {
    return json_false(res, "Please enter valid data");
  }

  var service = {
    title : data.title,
    description : data.description,
    state : data.state,
    city : data.city,
    time : currentTime,
    category_id : data.category_id,
    user_id : req.session.user.userId
  };
  console.log(service);
  pool.getConnection(function (err, connection) {
    var query = connection.query('INSERT INTO service SET ?', service, function(err, result) {
      connection.release();
      if (err) {
        console.log('db error is: ', err);
        res.json({result : false, msg : err});
      } else {
        if (result.affectedRows == 1) {
          insertTags(result.insertId, req.body.tags);
          //json_true(res, "register done!");
          //return;
        }
        console.log('result is: ', result.affectedRows);
      }
    });
    //console.log(query);
  });

  var insertTags = function (service_id, tags) {
    var query1 = "INSERT INTO service_tag (tag_name, service_id) VALUES ?";
    var values = [];
    for(var i = 0; i < tags.length; i++) {
      var arr = [];
      arr.push(tags[i]);
      arr.push(service_id);
      
      values.push(arr);
    }
    console.log(values);
    pool.getConnection(function (err, connection) {
      var query = connection.query(query1, [values], function(err, result) {
        connection.release();
        console.log(result);
        // add to tag_req
        if (err) {
          console.log('db error is: ', err);
          res.json({result : false, msg : err});
        } else {
          if (result.affectedRows == tags.length) {
            return json_true(res, "create done!");
          }
          //console.log('result is: ', result.affectedRows);
        }
      });
      //console.log(query);
    });
  };
});

//======= Create Request =========
app.get('/request_create', function (req, res) {
  var renderPage = function (cdata, tdata) {
    if (req.session.user) {
      res.render('pages/request_create', {cateData: cdata, tagData:tdata, MemberInfo:req.session.user});
    } else {
      res.redirect('/login');
    }
  }

  var getTags = function (cdata) {
    pool.getConnection(function (err, connection) {
      connection.query('SELECT * FROM tag;', function(err, rows) {
        connection.release();
        if (err) {
          console.log('db error is: ', err);

        } else {          
          var tdata = [];
          for(let i = 0; i < rows.length; i++) {
            tdata.push({
              tag_name: rows[i].tag_name
            });
          }
          //console.log('data: ', data)
          renderPage(cdata, tdata);
        }
      });
    });
  };

  pool.getConnection(function (err, connection) {
    connection.query('SELECT * FROM category;', function(err, rows) {
      connection.release();
      if (err) {
        console.log('db error is: ', err);

      } else {          
        var cdata = [];
        for(let i = 0; i < rows.length; i++) {
          cdata.push({
            category_id: rows[i].category_id,
            category_name: rows[i].category_name
          });
        }
        //console.log('data: ', data)
        getTags(cdata);
      }
    });
  });
});

app.post('/request_create', function (req, res) {
  var rawdata = req.body;

  var data = {
    title : rawdata.title,
    description : rawdata.description,
    city : rawdata.city,
    state : rawdata.state,
    category_id : rawdata.category_id,
    tags : rawdata.tags
  };

  var imagePath = '';
  if (rawdata.image != '') {
    imagePath = rawdata.image.replace("fakepath", "CMPE226");
  }

  

  var today = new Date();
  var currentTime = today.getFullYear() + '-' + (today.getMonth()+1) + '-' + today.getDate() + ' ' + today.getHours() + ':' + today.getMinutes() + ':' + today.getSeconds();
  var category_id = 0;
  if (data.title == '' || data.description == '') {
    return json_false(res, "Please enter valid data");
  }

  var request = {
    title : data.title,
    description : data.description,
    state : data.state,
    city : data.city,
    time : currentTime,
    category_id : data.category_id,
    user_id : req.session.user.userId
  };
  //console.log(request);
  pool.getConnection(function (err, connection) {
    var query = connection.query('INSERT INTO request SET ?', request, function(err, result) {
      connection.release();
      console.log('in', imagePath);
      // add to tag_req
      if (err) {
        console.log('db error is: ', err);
        res.json({result : false, msg : err});
      } else {
        if (result.affectedRows == 1) {
          var request_id = result.insertId;
          insertTags(request_id, req.body.tags, imagePath);
          //return json_true(res, "register done!");
        }
        //console.log('result is: ', result.affectedRows);
      }
    });
    //console.log(query);
  });

  var insertTags = function (request_id, tags, imagePath) {
    var query1 = "INSERT INTO request_tag (tag_name, request_id) VALUES ?";
    var values = [];
    for(var i = 0; i < tags.length; i++) {
      var arr = [];
      arr.push(tags[i]);
      arr.push(request_id);
      
      values.push(arr);
    }
    console.log(values);
    pool.getConnection(function (err, connection) {
      var query = connection.query(query1, [values], function(err, result) {
        connection.release();
        console.log(result);
        // add to tag_req
        if (err) {
          console.log('db error is: ', err);
          res.json({result : false, msg : err});
        } else {
          if (result.affectedRows == tags.length) {
            return json_true(res, "create done!");  
            //insertImage(request_id, imagePath)
          } else {
            return json_true(res, "create fail!");  
          }
          //console.log('result is: ', result.affectedRows);
        }
      });
      //console.log(query);
    });
  };

  var insertImage = function (request_id, imagePath) {
    console.log(imagePath);
    mongoose.connection.on('open', function () {
      var a = new imageModel({
        type:'request',
        id:request_id,
        image:fs.readFileSync(imagePath)
      });

      a.save(function (err, a) {
        if (err) {
          logger.info(err) ;
        } else {
          logger.info('saved img to mongo(request)' + request_id);
          //return json_true(res, "create done!");          
        }
      });
    });
  };
})

//======= Get Detail ========
app.get('/serDetail/:id', function (req, res) {
  var service_id = req.params.id;
  var query = "select s.service_id, s.title, s.time posttime, c.category_name, s.city, s.description, u.fname, u.phone, u.email, r.comment, r.time commenttime, avg(rate) avgrate from service as s, user as u, category as c, review as r where s.category_id = c.category_id and u.user_id = s.user_id and r.service_id = s.service_id and s.service_id = " + service_id + ";";
  pool.getConnection(function (err, connection) {
    connection.query(query, function(err, rows) {
      connection.release();
      if (err) {
        console.log('db error is: ', err);
      } else {          
        
        //console.log('data: ', data)
        //renderPage(data);
        getReviews(rows[0]);
      }
    });
  });

  var getReviews = function (detailData) {
    var reviewQuery = "select u.fname, r.time, r.comment, r.rate from review as r, user as u where u.user_id = r.user_id and r.service_id = " + service_id + ";";
    
    pool.getConnection(function (err, connection) {
      connection.query(reviewQuery, function(err, rows1) {
        connection.release();
        if (err) {
          console.log('db error is: ', err);
        } else {          
          
          //console.log('data: ', detailData)
          detailData.posttime = moment(detailData.posttime).format(dateFormat);
          //renderPage(data);
          if (req.session.user) {
            res.render('pages/serDetail', {data: detailData, reviews: rows1, service_id: service_id, MemberInfo: req.session.user});
          } else {
            res.render('pages/serDetail', {data: detailData, reviews: rows1, service_id: service_id});
          }
        }
      });
    });

  }
});

app.get('/reqDetail/:id', function (req, res) {
  var request_id = req.params.id;
  var query = "select r.request_id, r.title, r.time posttime, c.category_name, r.city, r.description, u.fname, u.phone, u.email from request as r, user as u, category as c where r.category_id = c.category_id and u.user_id = r.user_id and r.request_id = " + request_id + ";";
  //console.log(query)
  pool.getConnection(function (err, connection) {
    connection.query(query, function(err, rows) {
      connection.release();
      if (err) {
        console.log('db error is: ', err);
      } else {      
        rows[0].posttime = moment(rows[0].posttime).format(dateFormat);
        if (req.session.user) {
          res.render('pages/reqDetail', {data: rows[0], MemberInfo: req.session.user});
        } else {
          res.render('pages/reqDetail', {data: rows[0]});
        }
      }
    });
  });
});

app.post('/writereview', function (req, res) {
  console.log('revew', req.body)
  var today = new Date();
  var currentTime = today.getFullYear() + '-' + (today.getMonth()+1) + '-' + today.getDate() + ' ' + today.getHours() + ':' + today.getMinutes() + ':' + today.getSeconds();
  var reviewData = {
    user_id : req.body.user_id,
    service_id : req.body.service_id,
    time : currentTime,
    comment : req.body.comment,
    rate : req.body.rate
  };

  console.log(reviewData);
  
  pool.getConnection(function (err, connection) {
    connection.query('INSERT INTO review SET ?', reviewData,function(err, result) {
      connection.release();
      if (err) {
        console.log('db error is: ', err);
      } else {          
        console.log(result)
        if (result.affectedRows == 1) {
          return json_true(res, "review done!");
        } else {
          return json_false(res, "error while creating review!");
        }
      }
    });
  });
});

app.get('/favList', function (req, res) {
  var user_id = req.session.user.userId;
  console.log(user_id)
  var query = "select s.service_id, s.title, s.description, s.time from service as s, favorite as f where s.service_id = f.service_id and f.user_id = " + user_id + ";";
  pool.getConnection(function (err, connection) {
    connection.query(query, function (err, rows) {
      connection.release();
      if (err) {
        logger.warn('db error is:', err);
      } else {
        res.render('pages/favList', {servs: rows, MemberInfo: req.session.user})
      }
    })
  })
});

app.post('/deleteFav', function (req, res) {
  var service_id = req.body.service_id;
  console.log(service_id)
  var query = "delete from favorite where user_id = " + req.session.user.userId + " and service_id = " + service_id + ";";
  pool.getConnection(function (err, connection) {
    connection.query(query, function(err, result) {
      connection.release();
      if (err) {
        console.log('db error is: ', err);
      } else {          
        if (result.affectedRows == 1) {
          res.json({result : true, msg : "Delete Done!"});
        } else {
          res.json({result : false, msg : "Delete Fail!"});
        }
      }
    });
  })
});

app.post('/addFav', function (req, res) {
  var service_id = req.body.service_id;
  var query = "insert into favorite values(" + req.session.user.userId + ", " + service_id + ");";
  pool.getConnection(function (err, connection) {
    connection.query(query, function(err, result) {
      connection.release();
      if (err) {
        console.log('db error is: ', err);
      } else {          
        if (result.affectedRows == 1) {
          res.json({result : true, msg : "Add Done!"});
        } else {
          res.json({result : false, msg : "Add Fail!"});
        }
      }
    });
  })
});

function json_false (res, msg) {
	res.json({ result : false, msg : msg });
	return void(null);
}

function json_true (res, data) {
	res.json({ result : true, data : data });
	return void(null);
}

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

