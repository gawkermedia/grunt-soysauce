# soy-grunt-task

Grunt task to check and analyze Soy template and module JS files

## Getting Started
Install this grunt plugin next to your project's [grunt.js gruntfile][getting_started] with: `npm install https://github.com/gawkermedia/grunt-soysauce/archive/v0.1.0.tar.gz --save-dev`

Then add this line to your project's `grunt.js` gruntfile:

```javascript
grunt.loadNpmTasks('grunt-soysauce');
```

Configure the soy task in your initConfig call (everything is optional, these are the defaults):

```javascript
grunt.initConfig({
    ...
    soysauce: {
		options: {
			// path for your Soy files
			soySource: 'app/view/closure',
			// path for your JS files packaged by require.js
			jsTarget: 'target/scala2.10/classes/public/js-min'
			// path of the module you always load if you have such one, relative to jsTarget
			mainModule: 'module/Main.js',
			// all the modules you would like to analyze
			modules: [
				'module/Main.js',
				'module/foo.js',
				'module/bar.js'
			],
			// top level namespaces used in your Soy files
			namespaces: [
				'foo',
				'bar'
			],
			// Your custom logic telling if a namespace-filename pair is ok or not. You
			validateFilename: function (namespace, filename) {
				...
				if (ok) {
					return 'green';
				} else {
					return 'red';
				}
			}
    	}
	}
	...
});
```

## Tasks
- soysauce:mapping: task telling if your Soy namespaces align the folder and file structure of your Soy files
- soysauce:analyze: task telling how many of your JS templates are ununsed in JS package files and how many of them are missing

## License
Copyright (c) 2014 Gawker Media
Licensed under the MIT license.
