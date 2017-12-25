
const mysql = require('mysql');
const express = require('express');
const hbs = require ('hbs');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const moment = require('moment');

/*-----------------------------Data Base Connection and HandShake------------------------*/

const connection = mysql.createConnection({
    host: 'localhost',  
    user:'root',
    password: 'nadaAYMAN1234',
    database: 'librarydb'
});

connection.connect((err)=> {
    if(err) throw err;
    console.log('connected!');
});   

/*----------------------------------Handlebar Helpers------------------------------------*/

hbs.registerHelper('borrowStatus', (status)=>{
    return (status === 1)? 'on loan' : 'availabe';
})

hbs.registerHelper('borrowClass', (status)=>{
    return (status === 1)? 'warning' : 'success';
})

hbs.registerHelper('getDate', (date)=>{
    return Date.format('MMMM Do YYYY, h:mm:ss a');
})

/*----------------------------------App Server Middlewear--------------------------------*/
const authenticate = (request, response, next)=>{
    let user= request.cookies.user;
    if(user){
        connection.query(`SELECT * FROM authentication WHERE emplID=${user.emplID}`, (err, result)=>{
            if (err) throw err;
            if(result.length !== 0){
                next(); 
            }
            else
                response.redirect('login');
                // response.render('login')
        });
    }
    else
    response.redirect('login');
    
};

const getBooks = (request, response, next)=>{
    connection.query('SELECT bookID, bookName FROM book WHERE bookStatus=0', (err, result)=>{
        response.locals.books = result;
        next();
    });
}

const getAuthors = (request, response, next)=>{
    connection.query('SELECT authID, authName FROM author', (err, result)=>{
        response.locals.authors = result;
        next();
    });
}

const getBorrowers = (request, response, next)=>{
    connection.query('SELECT borwID, borName FROM borrower', (err, result)=>{
        response.locals.borrowers = result;
        next();
    });
}

/*------------------------------------App Server Setup----------------------------------*/
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

app.use(express.static(__dirname + '/public'));
app.set('view engine', 'hbs');

const port = 8000;
app.listen(port, ()=>{
    console.log('server is up on port 8000');
});

/*----------------------------------Url Handlers----------------------------------------*/


/*******HOME PAGE**********/
app.get('/', authenticate, (request, response)=>{
    connection.query(`SELECT emplName FROM employee WHERE emplID=${request.cookies.user.emplID}`,
        (err, result)=>{
            response.render('home', {emplName: result[0].emplName});
        });
    
});


/*******BOOKS PAGE**********/

app.get('/books',authenticate, (request, response)=>{
    // response.render('books');
    connection.query(`SELECT bookName, authName, creationYear, bookStatus FROM writebook JOIN book ON writebook.bookID=book.bookID 
    JOIN author ON writebook.authID=author.authID;`, (err, result, fields)=>{
        if (err) throw err;
        response.render('books/books',{books: result});
    })
});

app.get('/newbook', authenticate, getAuthors, (request, response)=>{
    response.render('books/newbook', {auths: response.locals.authors})
});

app.post('/newbook', authenticate, (request, response)=>{

    connection.query(`SELECT * FROM book WHERE bookName=\'${request.body.bookName}\'`,
    (err, result)=>{
        if(result.length === 0){
            connection.query(`INSERT INTO book(bookName, ISBN, creationYear, bookStatus) VALUES (\'${request.body.bookName}\',\'${request.body.ISBN}\',\'${request.body.creationYear}\', 0)`,
              (err, book)=>{
                  if (err) throw err;
                  connection.query(`INSERT INTO writebook(bookID, authID) VALUES (${book.insertId}, ${request.body.authID})`,
                    (err, done)=>{
                        response.redirect('/books')
                    })
              })
        }
        else
            response.render('/newbook', {error: 'Book Already Exist!'});
    });
});

app.get('/authors', authenticate, (request, response)=>{
    connection.query('SELECT * FROM author', (err, result, fields)=>{
        if (err) throw err;
        response.render('books/authors',{authors: result});
    })
});

app.get('/newauthor', authenticate, (request, response)=>{
    response.render('books/newauthor');
});

app.post('/newauthor', authenticate, (request, response)=>{
    // response.send(request.body)
       //check if daublicate
    connection.query(`SELECT * FROM author WHERE authName=\'${request.body.authName}\'`,
    (err, result)=>{
        if(result.length === 0) {
            connection.query(`INSERT INTO author(authName, adress) VALUES (\'${request.body.authName}\', \'${request.body.adress}\')`,
            (err, author)=>{
                if (err) throw err;
                connection.query(`INSERT INTO authorphone VALUES (\'${request.body.phoneNum}\', ${author.insertId})`, 
                (err, done)=>{
                    // console.log(done);
                    response.redirect('/authors');
                }); 
            })
        }
        else 
            response.render('books/newauthor', {error: 'Author Already Exist'});
    });
});


    /*******BORROWS PAGE**********/

app.get('/borrows', authenticate, (request, response)=>{
    connection.query(`select bookName, emplName, borName, borrowAt, bookStatus from borrowbook join book on book.bookID=borrowbook.bookID join employee on employee.emplID=borrowbook.emplID join borrower on borrower.borwID=borrowbook.borwID;`
        ,(err, rows, fields)=>{
            response.render('borrows/borrows', {borrows: rows});
        });
});

app.get('/newborrow', authenticate, getBorrowers, getBooks, (request, response)=>{
    // response.send(response.locals.borrowers);
    response.render('borrows/newborrow', {books: response.locals.books, borrowers: response.locals.borrowers});
});

app.post('/newborrow', authenticate, (request, response)=>{
    const user = request.cookies.user;
    const time = moment().format('MMMM Do YYYY, h:mm:ss');

    connection.query(`INSERT INTO borrowbook (bookID, emplID, borwID, borrowAt) VALUES (${request.body.bookID}, ${user.emplID}, ${request.body.borwID}, \'${time}\')`,
        (err, result)=>{
            if (err) throw err
            // console.log(result.insertId);
            connection.query(`UPDATE book SET bookStatus=1 WHERE bookID=${request.body.bookID};`,
                (err, done)=>{
                    if(err) throw err;
                    response.redirect('/borrows');
                })
        })
});

app.get('/borrowers', authenticate, (request, response)=>{
    connection.query(`SELECT * FROM borrower JOIN borrowerphone on borrowerphone.borwID=borrower.borwID;`, (err, result)=>{
        // console.log(result)
        response.render('borrows/borrowers', {borrowers: result});        
    });
});


app.get('/newborrower', authenticate, (request, response)=>{
    // response.send(response.locals.borrowers);
    response.render('borrows/newborrower');
});

app.post('/newborrower', authenticate, (request, response)=>{
    // response.send(request.body);
    connection.query(`SELECT * FROM borrower WHERE borName=\'${request.body.borName}\'`,
        (err, result)=>{
            if(err) throw err
            if(result.length === 0){
                    connection.query(`INSERT INTO borrower(borName, address, department, allowed_no) VALUES (\'${request.body.borName}\', \'${request.body.adress}\', \'${request.body.department}\', ${request.body.allowed_no})`,
                        (err, borrower)=>{
                            if(err) throw err;
                            connection.query(`INSERT INTO borrowerphone VALUES(\'${request.body.phoneNum}\', ${borrower.insertId})`,
                                (err, done)=>{
                                    response.redirect('/borrowers')
                                })
                        })
                
            }
            else
                response.render('borrows/newborrower', {error: 'Client Already Exist!'});
        })
});

    /*******AUTHEN PAGE**********/

app.get('/login', (request, response)=>{
    if(request.cookies.user)   
        response.redirect('/');
    
        response.render('authentication/login');
})

app.get('/logout', authenticate, (request, response)=>{
    response.clearCookie('user').redirect('/');
})

app.post('/login', (request, response)=>{
    
    connection.query(`SELECT emplID, priviladge FROM employee WHERE emplName=\'${request.body.emplName}\' AND emplPassword=\'${request.body.emplPassword}\'`,
        (err, result)=>{
            if(result.length !== 0){                
                connection.query(`INSERT INTO authentication VALUES (${result[0].emplID}, ${result[0].priviladge})`, (err, user)=>{
                    response.cookie('user', result[0]).redirect('/')
                });
            }
            else{
            response.render('authentication/login', {error: 'enter valid user name and password'})
                
            }
        }
    )
})