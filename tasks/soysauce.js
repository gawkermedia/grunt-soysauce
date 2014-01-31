/*global module, require */
/*
 * grunt-soysauce
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
		addTemplate = function (mapping, namespace, filename, template) {
			var node = namespace.shift();
			if (!mapping[node]) {
				mapping[node] = {};
			}

			if (namespace.length > 0) {
				addTemplate(mapping[node], namespace, filename, template);
			} else {
				if (!mapping[node]._files) {
					mapping[node]._files = {};
				}

				if (!mapping[node]._files[filename]) {
					mapping[node]._files[filename] = [];
				}

				mapping[node]._files[filename].push(template);
			}
		},
		lineReader = function (filename, mapping) {
			return function (line) {
				var match = line.match('{namespace (.*)}');
				if (match) {
					mapping.namespace = match[1];
				} else {
					match = line.match('{template .([a-zA-Z0-9_]*)');
					if (match) {
						addTemplate(mapping.result, mapping.namespace.split('.'), filename, match[1]);
					}
				}
			};
		},
		fileReader = function (mapping, filename) {
			_.each(grunt.file.read(filename).split('\n'), lineReader(filename, mapping));
			return mapping;
		},
		namespaceFileTemplateMapping = function () {
			var retval = _.reduce(soyList, fileReader, {
				result: {},
				namespace: {}
			}).result;

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
			tabs = function (indent) {
				return new Array(indent).join('\t');
			},
			fileRenderer = function (namespace) {
				return function (templateList, filename) {
					var color = options.validateFilename(namespace.join('.'), filename);
					counter.files += 1;
					if (color === 'red') {
						counter.misplaced += 1;
					}

					grunt.log.writeln(tabs(namespace.length + 1) + filename.replace(options.soySource + '/', '')[color]);
				};
			},
			namespaceRenderer = function (namespace) {
				var shadow;
				return function (namespaceList, name) {
					shadow = _.clone(namespace);

					if (name !== '_files') {
						shadow.push(name);
						grunt.log.writeln(tabs(shadow.length) + name);

						if (namespaceList._files) {
							counter.namespaces += 1;
							_.each(namespaceList._files, fileRenderer(shadow));
						}

						_.each(namespaceList, namespaceRenderer(shadow));
					}
				};
			};

		_.each(namespaceFileTemplateMapping(), namespaceRenderer([]));

		grunt.log.writeln();
		if (counter.misplaced > 0) {
			grunt.log.error(counter.files + ' files in ' + counter.namespaces + ' namespaces, ' + counter.misplaced + ' files misplaced.');
		} else {
			grunt.log.ok(counter.files + ' files in ' + counter.namespaces + ' namespaces, all seems to be fine.');
		}
	});

	grunt.registerTask('soysauce:analyze', function () {
		var counter = {
				defined: [],
				called: [],
				unused: [],
				missing: [],
				size: {}
			},
			report = function (templates, message) {
				if (templates.length > 0) {
					grunt.log.subhead('Templates ' + message + '?');
					_.each(templates, function (template) {
						if (message === 'unused') {
							grunt.log.writeln(Math.floor(counter.size[template] / 10.24) / 100 + ' KiB ' + template);
						} else {
							grunt.log.writeln('??'.red + ' ' + template);
						}
					});
				} else {
					grunt.log.ok('No templates ' + message + '.');
				}
			},
			analyzeModule = function (module) {
				var filename = options.jsTarget + '/' + module,
					lines = grunt.file.read(filename).split('\n'),
					retval = {
						defined: [],
						called: [],
						size: {}
					},
					defineRegExp = new RegExp('(.*) = function\\(opt_data, opt_sb, opt_ijData\\)'),
					callRegExp = new RegExp('((' + options.namespaces.join('\\.|') + '\\.)[\.a-zA-Z0-9\-\_]+)', 'g'),
					countingTo = false;

				_.each(lines, function (line) {
					var match = line.match(defineRegExp);

					if (match) {
						retval.defined.push(match[1]);
						countingTo = match[1];
						retval.size[countingTo] = 0;
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

					if (countingTo) {
						retval.size[countingTo] += line.length;
					}

					if (line.trim() === '};') {
						countingTo = false;
					}
				});

				retval.defined = _.unique(retval.defined.sort());
				retval.called = _.unique(retval.called.sort());

				return retval;
			},
			sizeSort = function (element) {
				return -counter.size[element];
			},
			mainTemplates = analyzeModule(options.mainModule);

		_.each(options.modules, function (module) {
			var moduleTemplates = analyzeModule(module);

			counter.defined = _.union(counter.defined, moduleTemplates.defined);
			counter.called = _.union(counter.called, moduleTemplates.called);
			counter.size = _.extend(counter.size, moduleTemplates.size);

			grunt.log.subhead('=== ' + module + ' ===');
			report(_.sortBy(_.difference(moduleTemplates.defined, moduleTemplates.called), sizeSort), 'unused');
			report(_.difference(moduleTemplates.called, _.union(mainTemplates.defined, moduleTemplates.defined)), 'missing');
		});

		grunt.log.writeln();
		counter.unused = _.sortBy(_.difference(counter.defined, counter.called), sizeSort);
		counter.missing = _.difference(counter.called, counter.defined);
		if (counter.unused.length + counter.missing.length > 0) {
			grunt.log.error(counter.unused.length + ' templates unused, ' + counter.missing.length + ' templates missing.');

			_.each(['unused', 'missing'], function (status) {
				report(counter[status], status);
			});
		} else {
			grunt.log.ok('All seems to be fine.');
		}
	});
};
