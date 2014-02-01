/*global module, require */
/*
 * grunt-soysauce
 * https://github.com/gawkermedia/grunt-soysauce
 *
 * Copyright (c) 2014 Gawker Media
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
				}());

			return _.find(patterns, function (pattern) {
				return filename.match(pattern) !== null;
			});
		}
	};

module.exports = function (grunt) {
	var options = _.extend(defaults, grunt.config('soysauce.options')),
		soyList = grunt.file.expand([
			options.soyPath + '/**/*.soy'
		]),
		addTemplate = function (mapping, namespace, filename, template, calledTemplate) {
			var node = namespace.shift();
			if (!mapping[node]) {
				mapping[node] = {};
			}

			if (namespace.length > 0) {
				addTemplate(mapping[node], namespace, filename, template, calledTemplate);
			} else {
				mapping[node]._files = mapping[node]._files || {};
				mapping[node]._files[filename] = mapping[node]._files[filename] || {};
				mapping[node]._files[filename][template] = mapping[node]._files[filename][template] || [];

				if (calledTemplate) {
					mapping[node]._files[filename][template] = _.union(mapping[node]._files[filename][template], [
						calledTemplate
					]);
				}
			}
		},
		lineReader = function (filename, mapping) {
			return function (line) {
				var match = line.match('{namespace (.*)}');
				if (match) {
					mapping.currentNamespace = match[1];
				} else {
					match = line.match('{(template|call) ([.a-zA-Z0-9_]*)');
					if (match) {
						if (match[2].substr(0, 1) === '.') {
							match[2] = mapping.currentNamespace + match[2];
						}

						if (match[1] === 'template') {
							mapping.currentTemplate = match[2];
							addTemplate(mapping.result, mapping.currentNamespace.split('.'), filename, mapping.currentTemplate);
						} else {
							addTemplate(mapping.result, mapping.currentNamespace.split('.'), filename, mapping.currentTemplate, match[2]);
						}
					}
				}
			};
		},
		soyFileReader = function (mapping, filename) {
			_.each(grunt.file.read(filename).split('\n'), lineReader(filename, mapping));
			return mapping;
		},
		namespaceFilenameTemplateMapping = function () {
			var retval = _.reduce(soyList, soyFileReader, {
				result: {},
				currentNamespace: {},
				currentTemplate: {}
			}).result;

			namespaceFilenameTemplateMapping = function () {
				return retval;
			};

			return retval;
		},
		templateSize = {},
		templateReport = function (templates, resource, message) {
			if (templates.length > 0) {
				grunt.log.subhead('\t' + resource + ' ' + message + '?');
				_.each(templates, function (template) {
					if (templateSize[template]) {
						grunt.log.writeln('\t' + Math.floor(templateSize[template] / 10.24) / 100 + ' KiB ' + template);
					} else {
						grunt.log.writeln('\t' + template);
					}
				});
			}
		};

	grunt.registerTask('soysauce:namespaces', function () {
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
					counter.files += 1;
					if (options.validateFilename(namespace.join('.'), filename)) {
						grunt.log.writeln(tabs(namespace.length + 1) + filename.replace(options.soyPath + '/', ''));
					} else {
						counter.misplaced += 1;
						grunt.log.writeln(tabs(namespace.length + 1) + filename.replace(options.soyPath + '/', '').red);
					}
				};
			},
			namespaceRenderer = function (namespace) {
				var shadow;
				return function (namespaceList, name) {
					shadow = _.clone(namespace);

					if (name !== '_files') {
						shadow.push(name);
						grunt.log.writeln((tabs(shadow.length) + name).bold);

						if (namespaceList._files) {
							counter.namespaces += 1;
							_.each(namespaceList._files, fileRenderer(shadow));
						}

						_.each(namespaceList, namespaceRenderer(shadow));
					}
				};
			};

		_.each(namespaceFilenameTemplateMapping(), namespaceRenderer([]));

		grunt.log.writeln();
		if (counter.misplaced > 0) {
			grunt.log.error(counter.files + ' files in ' + counter.namespaces + ' namespaces, ' + counter.misplaced + ' files misplaced.');
		} else {
			grunt.log.ok(counter.files + ' files in ' + counter.namespaces + ' namespaces, all seems to be fine.');
		}
	});

	grunt.registerTask('soysauce:analyze-source', function () {

		var bogus = 0,
			templateFilenameMapper = function (retval, namespaceData, namespace) {
				if (_.isObject(namespaceData) && namespace !== '_files') {
					_.reduce(namespaceData, templateFilenameMapper, retval);
					if (namespaceData._files) {
						_.each(namespaceData._files, function (templates, filename) {
							_.each(templates, function (calledTemplates, template) {
								retval[template] = filename.replace(options.soyPath + '/', '');
							});
						});
					}
				}

				return retval;
			},
			templateFilenameMapping = _.reduce(namespaceFilenameTemplateMapping(), templateFilenameMapper, {}),
			filenameTemplateMappig = _.reduce(templateFilenameMapping, function (retval, filename, template) {
				retval[filename] = retval[filename] || [];
				retval[filename].push(template);

				return retval;
			}, {}),
			templateTemplateMapper = function (retval, namespaceData, namespace) {
				if (_.isObject(namespaceData) && namespace !== '_files') {
					_.reduce(namespaceData, templateTemplateMapper, retval);
					if (namespaceData._files) {
						_.each(namespaceData._files, function (templates) {
							_.each(templates, function (calledTemplates, template) {
								retval[template] = calledTemplates;
							});
						});
					}
				}

				return retval;
			},
			templateTemplateMapping = (function () {
				var oneLevelMapping = _.reduce(namespaceFilenameTemplateMapping(), templateTemplateMapper, {}),
					recursiveMapper = function (template) {
						var retval = [
							template
						];

						if (oneLevelMapping[template]) {
							retval = _.union(retval, _.map(oneLevelMapping[template], recursiveMapper));
						}

						return retval;
					};

				return _.reduce(oneLevelMapping, function (retval, calledTemplates, template) {
					if (calledTemplates.length > 0) {
						retval[template] = _.unique(_.flatten(_.map(calledTemplates, recursiveMapper)).sort());
					}

					return retval;
				}, {});
			}()),
			analyzeFile = function (path) {
				var retval = {
						unused: [],
						missing: []
					},
					lines = grunt.file.read(path).split('\n'),
					requireRegExp = new RegExp(options.jsTemplateDir + '/([.a-zA-Z0-9-_/]+)'),
					callRegExp = new RegExp('((' + options.namespaces.join('\\.|') + '\\.)[\\.a-zA-Z0-9\-\_]+)', 'g'),
					requiredFiles = [],
					calledTemplates = [],
					neededFiles = [];

				_.each(lines, function (line) {
					var match = line.match(requireRegExp);
					if (match) {
						requiredFiles.push(match[1] + '.soy');
					} else {
						match = line.match(callRegExp);
						if (match !== null) {
							_.each(match, function (hit) {
								calledTemplates.push(hit);
							});
						}
					}
				});

				neededFiles = _.unique(_.flatten(_.map(calledTemplates, function (template) {
					var retval = _.map(templateTemplateMapping[template], function (subTemplate) {
						return templateFilenameMapping[subTemplate];
					});

					retval.push(templateFilenameMapping[template]);

					return retval;
				})));
				retval.unused = _.unique(_.difference(requiredFiles, neededFiles)).sort();
				retval.missing = _.unique(_.difference(neededFiles, requiredFiles)).sort();
				retval.overcrowded = _.unique(_.filter(neededFiles, function (filename) {
					var allTemplates = _.flatten(_.union(calledTemplates, _.map(calledTemplates, function (template) {
						return templateTemplateMapping[template];
					})));
					return _.difference(filenameTemplateMappig[filename], allTemplates).length > 0;
				})).sort();

				return retval;
			};

		_.each(options.jsFiles, function (path) {
			var fileData = analyzeFile(path);

			if (fileData.unused.length + fileData.missing.length > 0) {
				bogus += 1;
				grunt.log.subhead('=== ' + path + ' ===');
				_.each(['unused', 'missing', 'overcrowded'], function (status) {
					templateReport(fileData[status], 'Files', status);
				});
			}
		});

		grunt.log.writeln();
		if (bogus > 0) {
			grunt.log.error(options.jsFiles.length + ' files processed, ' + bogus + ' files found with problems.');
		} else {
			grunt.log.ok(options.jsFiles.length + ' files processed, all seems to be fine.');
		}
	});

	grunt.registerTask('soysauce:analyze-modules', function () {
		var counter = {
				defined: [],
				called: [],
				unused: [],
				missing: [],
				size: {}
			},
			analyzeModule = function (module) {
				var filename = options.jsPath + '/' + module,
					lines = grunt.file.read(filename).split('\n'),
					retval = {
						defined: [],
						called: [],
						size: {},
						calledBy: {}
					},
					defineRegExp = new RegExp('(.*) = function\\(opt_data, opt_sb, opt_ijData\\)'),
					callRegExp = new RegExp('((' + options.namespaces.join('\\.|') + '\\.)[\\.a-zA-Z0-9\-\_]+)', 'g'),
					countingTo = false,
					calledBy = function (caller, callee) {
						retval.calledBy[caller] = retval.calledBy[caller] || [];

						if (retval.calledBy[caller].indexOf(callee) < 0) {
							retval.calledBy[caller].push(callee);
						}
					},
					collectCallChain = function (template) {
						if (retval.calledBy[template]) {
							return _.union(retval.calledBy[template], _.flatten(_.map(retval.calledBy[template], function (subTemplate) {
								return collectCallChain(subTemplate);
							})));
						} else {
							return [];
						}
					};

				_.each(lines, function (line) {
					var match = line.match(defineRegExp);

					if (match) {
						retval.defined.push(match[1]);
						countingTo = match[1];
						templateSize[countingTo] = 0;
					} else {
						match = line.match(callRegExp);
						if (match !== null) {
							_.each(match, function (hit) {
								if (line.indexOf('if (typeof ' + hit) < 0) {
									if (countingTo) {
										calledBy(countingTo, hit);
									} else {
										calledBy('JS', hit);
									}
								}
							});
						}
					}

					if (countingTo) {
						templateSize[countingTo] += line.length;
					}

					if (line.trim() === '};') {
						countingTo = false;
					}
				});

				retval.defined = _.unique(retval.defined.sort());
				retval.called = collectCallChain('JS');

				return retval;
			},
			sizeSort = function (element) {
				return -templateSize[element];
			},
			mainTemplates = analyzeModule(options.mainModule),
			bogus = 0;

		_.each(options.modules, function (module) {
			var moduleTemplates = analyzeModule(module),
				unused = _.sortBy(_.difference(moduleTemplates.defined, moduleTemplates.called), sizeSort),
				missing = _.difference(moduleTemplates.called, _.union(mainTemplates.defined, moduleTemplates.defined)).sort();

			counter.defined = _.union(counter.defined, moduleTemplates.defined);
			counter.called = _.union(counter.called, moduleTemplates.called);
			counter.size = _.extend(counter.size, moduleTemplates.size);

			if (unused.length + missing.length > 0) {
				bogus += 1;
				grunt.log.subhead('=== ' + module + ' ===');
				templateReport(unused, 'Templates', 'unused');
				templateReport(missing, 'Templates', 'missing');
			}
		});

		grunt.log.writeln();
		if (bogus > 0) {
			grunt.log.error(options.modules.length + ' files processed, ' + bogus + ' files found with problems.');
		} else {
			grunt.log.ok(options.modules.length + ' files processed, all seems to be fine.');
		}
	});
};
