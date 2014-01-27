module.exports = function(grunt) {

	// Project configuration.
	grunt.initConfig({});

	// Load local tasks.
	grunt.loadTasks('tasks');

	// Default task.
	grunt.registerTask('default', 'lint test');

};
