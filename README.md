# grunt-soysauce

A bunch of Grunt tasks to check and analyze Soy template and JS files.

## Tasks
- **soysauce:namespaces**: A task telling if your Soy namespaces align the folder and file structure of your Soy files. Files off are listed in red. Basic default rule is a Soy file in the `foo.bar.baz` namespace should either have the path `foo/bar/baz.soy` or `foo/bar/baz/whatever.soy`, but you can set up your own rules if you would like.
- **soysauce:analyze-source**: A task telling how many of your Soy templates are unused in JS source files and how many of them are missing. Also telling if a Soy file used is overcrowded with templates - if it has more templates than used by the given JS files.
- **soysauce:analyze-modules**: A task telling how many of your JS templates are unused in JS module files and how many of them are missing.

## Getting Started
Install this grunt plugin with: `npm install https://github.com/gawkermedia/grunt-soysauce/archive/v0.4.15.tar.gz --save-dev`

Then add this line to your project's `grunt.js` gruntfile:

```javascript
grunt.loadNpmTasks('grunt-soysauce');
```

## Configuration
Configure the soy task in your initConfig call. You must set all options except `soy.whiteList` and `soy.validateFilename`, those are optional.

```javascript
grunt.initConfig({
	...
	soysauce: {
		options: {
			soy: {
				// Path for your Soy files.
				path: 'app/view/closure',
				// A list of files you don't want to get reported as overcrowded.
				whiteList: [
					'foo/bar.soy'
				],
				// Your custom logic telling if a namespace-filename pair is ok or not. Returns boolean.
				validateFilename: function (namespace, filename) {
					...
					if (ok) {
						return true;
					} else {
						return false;
					}
				}
			},
			js: {
				// Path for your JS files.
				path: 'target/scala2.10/classes/public/js-min',
				// Path where your Soy/JS template files are generated to, relative to jsPath.
				templateDir: 'templates',
				// List of JS files you would like to analyze in soysauce:analyze-source task.
				files: global.mantle.jsFilesExceptLib(),
				// Path of the module you always load if you have such one, relative to jsPath.
				mainModule: 'module/Main.js',
				// List of JS modules you would like to analyze in soysauce:analyze-modules task.
				modules: [
					'module/Main.js',
					'module/foo.js',
					'module/bar.js'
				]
			},
			// Top level namespaces used in your Soy files.
			namespaces: [
				'foo',
				'bar'
			],
			// XML report paths used when running the tasks
			reports: {
				namespaces: 'target/grunt/soysauce/namespaces.xml',
				analyzeSource: 'target/grunt/soysauce/analyze-source.xml'
			}
		}
	}
	...
});
```

## License
Copyright (c) 2014 Gawker Media
Licensed under the MIT license.
