module.exports = function (grunt) {

    grunt.initConfig({
		clean: [
			'build/'
		],
        bower_concat: {
            all: {
                dest: 'build/js/bower.js',
                cssDest: 'build/css/bower.css',
                dependencies: {
                    
                },
                bowerOptions: {
                    relative: false
                }
            }
        },
        cssmin: {
            target: {
                files: {
                    'build/css/main.min.css': ['build/css/bower.css', 'build/css/less.css'],
                }
            }
        },
        uglify: {
            options: {
                sourceMap: true
            },
            my_target: {
                files: [{
                        'build/js/main.min.js': ['build/js/bower.js', 'js/main.js'],
                    }]
            }
        },
		less: {
			development: {
				options: {
					sourceMap: true
				},
				files: {
					"build/css/less.css": "less/main.less"
				}
			}
		},
		imageEmbed: {
			dist: {
				src: [ "build/css/main.min.css" ],
				dest: "build/css/main.min.css",
				options: {
					deleteAfterEncoding : false
				}
			}
		},
        copy: {
            dist: {
                files: [
                    {
                        expand: true,
                        dot: true,
                        cwd: 'bower_components/',
                        dest: 'build/',
                        src: [
                            '*.{ico,png,txt}',
                            '.htaccess',
                            'images/{,*/}*.webp',
                            '{,*/}*.html',
                            'styles/fonts/{,*/}*.*'
                        ]
                    },
                    { //for bootstrap fonts						
                        expand: true,
                        dot: true,
                        cwd: 'bower_components/bootstrap/dist',
                        src: ['fonts/*.*'],
                        dest: 'build/'
                    },
                    { //for font-awesome
                        expand: true,
                        dot: true,
                        cwd: 'bower_components/font-awesome',
                        src: ['fonts/*.*'],
                        dest: 'build/'
                    },
                    { //for flags
                        expand: true,
                        dot: true,
                        cwd: 'bower_components/flag-icon-css',
                        src: ['flags/**/*.*'],
                        dest: 'build/'
                    }]
            }
        },
		watch: {
			scripts: {
				files: ['bower_components/**/*.js', 'js/**/*.js'],
				tasks: ['uglify'],
				options: {
					spawn: false,
				},
			},
			bower: {
				files: ['bower_components/**/*.*'],
				tasks: ['copy', 'bower_concat', 'uglify'],
				options: {
					spawn: false,
				},
			},
			less: {
				files: ['less/**/*.less'],
				tasks: ['less', 'cssmin', 'imageEmbed'],
				options: {
					spawn: false,
				},
			},
			css: {
				files: ['build/css/less.css', 'build/css/bower.css'],
				tasks: ['cssmin', 'imageEmbed'],
				options: {
					spawn: false,
				},
			},
		}
    });

    grunt.loadNpmTasks('grunt-bower-concat');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks("grunt-image-embed");
	grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('default', ['watch']);

};