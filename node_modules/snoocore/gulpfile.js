var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;

var gulp = require('gulp');
var gutil = require('gulp-util');
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');
var babel = require('gulp-babel');

var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var browserify = require('browserify');

gulp.task('copyTestConfig', function(done) {
  var configPath = path.join(__dirname, 'test', 'config.js');
  var configTemplatePath = configPath + '.template';

  fs.exists(configPath, function(exists) {
    if (exists) {
      return done();
    }

    fs.createReadStream(configTemplatePath)
      .pipe(fs.createWriteStream(configPath))
      .on('finish', done);
  });
});

gulp.task('babel', function() {
  return gulp.src('./src/**/*.js')
             .pipe(sourcemaps.init())
             .pipe(babel())
             .pipe(sourcemaps.write('./'))
             .pipe(gulp.dest('./build/src/'));
});

gulp.task('babelTests', [ 'copyTestConfig' ], function() {
  return gulp.src('./test/**/*.js')
             .pipe(sourcemaps.init())
             .pipe(babel())
             .pipe(sourcemaps.write('./'))
             .pipe(gulp.dest('./build/test/'));
});

gulp.task('bundleBrowser', [ 'babel' ], function() {
  // set up the browserify instance on a task basis
  var b = browserify({
    entries: './build/src/Snoocore.js',
    // exclude: [ './build/src/https/httpsNode.js' ],
    standalone: 'Snoocore',
    debug: true
  });

  return b.bundle()
          .pipe(source('Snoocore-browser.min.js'))
          .pipe(buffer())
          .pipe(sourcemaps.init())
          .pipe(uglify())
          .on('error', gutil.log)
          .pipe(sourcemaps.write('./'))
          .pipe(gulp.dest('./dist/'));
});

gulp.task('bundleBrowserTests', [ 'babelTests' ], function() {
  // set up the browserify instance on a task basis
  var b = browserify({
    entries: './build/test/browser-tests.js',
    standalone: 'SnoocoreTests',
    debug: true
  });

  return b.bundle()
          .pipe(source('browser-tests.js'))
          .pipe(buffer())
          .pipe(sourcemaps.init())
          .on('error', gutil.log)
          .pipe(sourcemaps.write('./'))
          .pipe(gulp.dest('./build/test/'));
});

gulp.task('buildNode', [ 'babel', 'babelTests' ]);

gulp.task('mocha', [ 'buildNode' ], function(done) {
  var mocha = spawn(
    path.join(__dirname, 'node_modules', '.bin', 'mocha'),
    [
      '-R', 'spec',
      'build/test/node-tests.js'
    ],
    { cwd: __dirname, stdio: 'inherit' }
  );

  mocha.on('exit', function(code) {
    return (code !== 0)
      ? done(new Error('Mocha tests failed to run'))
      : done();
  });
});

gulp.task('buildBrowser', [ 'bundleBrowser', 'bundleBrowserTests' ]);

gulp.task('karma', [ 'buildBrowser' ], function(done) {
  var karma = spawn(
    path.join(__dirname, 'node_modules', 'karma', 'bin', 'karma'),
    [ 'start', 'build/test/karma.conf.js'  ],
    { cwd: __dirname, stdio: 'inherit' }
  );

  karma.on('exit', function(code) {
    return (code !== 0)
      ? done(new Error('Karma tests failed to run'))
      : done();
  });
});

// The default task (called when you run `gulp` from cli)
gulp.task('default', function(done) {
  console.error('no default task!');
  done();
});
