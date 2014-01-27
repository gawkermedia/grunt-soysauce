/*global module, require */
/*
 * grunt-soy-grunt-task
 * https://github.com/gawkermedia/grunt-soysauce
 *
 * Copyright (c) 2014 Jozsef Kozma
 * Licensed under the MIT license.
 */

'use strict';

var _ = require('underscore'),
	defaults = {
		validateFilename: function (namespace, filename) {
			var patterns = (function () {
					var namespaceParts = namespace.split('.');

					return [
						namespaceParts.join('/') + '.soy',
						namespaceParts.join('/') + '/([^/]+).soy'
					];
				}()),
				retval = 'red';

			if (_.find(patterns, function (pattern) {
				return filename.match(pattern) !== null;
			})) {
				retval = 'green';
			}

			return retval;
		}
	};

module.exports = function (grunt) {
	var options = _.extend(defaults, grunt.config('soysauce.options')),
		soyList = grunt.file.expand([
			options.soySource + '/**/*.soy'
		]),
		lineReader = function (filename, mapping) {
			return function (line) {
				var match = line.match('{namespace (.*)}');
				if (match) {
					mapping.namespace = match[1];
				} else {
					match = line.match('{template .([a-zA-Z0-9_]*)');
					if (match) {
						if (!mapping.result[mapping.namespace]) {
							mapping.result[mapping.namespace] = {};
						}

						if (!mapping.result[mapping.namespace][filename]) {
							mapping.result[mapping.namespace][filename] = [];
						}

						mapping.result[mapping.namespace][filename].push(match[1]);
					}
				}
			};
		},
		fileReader = function (mapping, filename) {
			_.each(grunt.file.read(filename).split('\n'), lineReader(filename, mapping));
			return mapping;
		},
		templateFunctions = [],
		namespaceFileTemplateMapping = function () {
			var retval = _.reduce(soyList, fileReader, {
				result: {},
				namespace: {}
			}).result;

			templateFunctions = _.flatten(_.map(retval, function (namespaceData, namespace) {
				return _.map(namespaceData, function (templates) {
					return _.map(templates, function (template) {
						return namespace + '.' + template;
					});
				});
			}));

			namespaceFileTemplateMapping = function () {
				return retval;
			};

			return retval;
		};

	grunt.registerTask('soysauce:mapping', function () {
		var counter = {
				namespaces: 0,
				files: 0,
				misplaced: 0
			},
			templateRenderer = function (templateName) {
				grunt.log.writeln('\t\t.' + templateName);
			},
			fileRenderer = function (namespace) {
				return function (templateList, filename) {
					var color = options.validateFilename(namespace, filename);
					counter.files += 1;
					if (color === 'red') {
						counter.misplaced += 1;
					}

					grunt.log.writeln('\t' + filename[color]);
					_.each(templateList, templateRenderer);
				};
			},
			namespaceRenderer = function (fileList, namespace) {
				counter.namespaces += 1;
				grunt.log.subhead('=== ' + namespace + ' ===');
				_.each(fileList, fileRenderer(namespace));
			};

		_.each(namespaceFileTemplateMapping(), namespaceRenderer);

		grunt.log.writeln();
		if (counter.misplaced > 0) {
			grunt.log.error(counter.files + ' files in ' + counter.namespaces + ' namespaces, ' + counter.misplaced + ' files misplaced.');
		} else {
			grunt.log.ok(counter.files + ' files in ' + counter.namespaces + ' namespaces, all seems to be fine.');
		}
	});

	grunt.registerTask('soysauce:analyze', function () {
		var counter = {
				unused: 0,
				missing: 0
			},
			report = function (minuend, subtrahend, sign, message) {
				var difference = _.difference(minuend, subtrahend);
				if (difference.length) {
					grunt.log.subhead('Templates ' + message + '?');
					_.each(_.unique(difference), function (template) {
						grunt.log.writeln((sign.red + ' ' + template));
					});
					if (sign === '++') {
						counter.unused += difference.length;
					} else {
						counter.missing += difference.length;
					}
				} else {
					grunt.log.ok('No templates ' + message + '.');
				}
			},
			analyzeModule = function (module) {
				var filename = options.jsTarget + '/' + module,
					lines = grunt.file.read(filename).split('\n'),
					retval = {
						defined: [],
						called: []
					},
					defineRegExp = new RegExp('(.*) = function\\(opt_data, opt_sb, opt_ijData\\)'),
					callRegExp = new RegExp('((' + options.namespaces.join('\\.|') + '\\.)[\.a-zA-Z0-9\-\_]+)', 'g');

				_.each(lines, function (line) {
					var match = line.match(defineRegExp);

					if (match) {
						retval.defined.push(match[1]);
					} else {
						match = line.match(callRegExp);
						if (match !== null) {
							_.each(match, function (hit) {
								if (line.indexOf('if (typeof ' + hit) < 0) {
									retval.called.push(hit);
								}
							});
						}
					}
				});

				retval.defined = _.unique(retval.defined.sort());
				retval.called = _.unique(retval.called.sort());

				return retval;
			},
			mainTemplates = analyzeModule(options.mainModule);

		_.each(options.modules, function (module) {
			var moduleTemplates = analyzeModule(module);

			grunt.log.subhead('=== ' + module + ' ===');
			report(moduleTemplates.defined, moduleTemplates.called, '++', 'unused');
			report(moduleTemplates.called, _.union(mainTemplates.defined, moduleTemplates.defined), '--', 'missing');
		});

		grunt.log.writeln();
		if (counter.unused + counter.missing > 0) {
			grunt.log.error(counter.unused + ' templates unused, ' + counter.missing + ' templates missing.');
		} else {
			grunt.log.ok('All seems to be fine.');
		}
	});
};
