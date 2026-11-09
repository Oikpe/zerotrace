var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var experimentsRouter = require('./routes/experiments');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/experiments', experimentsRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  var requestPath = req.path.toLowerCase();
  var isJsonRequest = requestPath === '/health' || requestPath === '/health/' ||
    requestPath === '/api' || requestPath.indexOf('/api/') === 0;
  if (isJsonRequest) {
    var status = err.status || 500;
    var databaseUnavailableCodes = [
      'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH',
      'ENETUNREACH', 'EPIPE', '3D000', '42P01', '42501', '57014'
    ];
    var databaseUnavailableMessages = [
      'Connection terminated unexpectedly',
      'Connection terminated due to connection timeout',
      'timeout exceeded when trying to connect',
      'Query read timeout'
    ];
    // SQLSTATE classes cover connection, authentication, resource and shutdown failures.
    if (databaseUnavailableCodes.includes(err.code) ||
        /^(08|28|53|57P0)/.test(err.code || '') ||
        databaseUnavailableMessages.includes(err.message)) {
      status = 503;
    }

    var messages = {
      400: err.type === 'entity.parse.failed' ? 'Invalid JSON body.' : 'Invalid request.',
      404: 'Not found.',
      413: 'JSON body is too large.',
      415: 'Unsupported media type.',
      503: 'Database unavailable.'
    };
    return res.status(messages[status] ? status : 500).json({
      error: messages[status] || 'Internal server error.'
    });
  }

  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
