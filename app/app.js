'use strict';

//TODO split up this file into controllers, directives, views
//for such a simple app, this file is acceptable.

// Declare app level module which depends on views, and components
var jobtracker = angular.module('jobtracker', ['ngRoute', 'ngCookies' ]);

//Interceptor
var interceptor = function($q, $cookieStore, $location){
    return {
        request: function(config){
            //console.log('localStorage' + $cookieStore.get('token'));
            console.log($location.path());
            //config.headers = config.header || {};
            if ($location.path() != '/login') {
                if ($cookieStore.get('token')) {
                    config.headers.Authorization = 'Bearer ' + $cookieStore.get('token');
                }
            }

            return config
        },
        response: function(result){
            return result;
        },
        responseError: function(response){
            console.log('Failed with', response.status, 'status');
            if (response.status === 401 || response.status === 403) {
                $location.path('/login');
            }
            return $q.reject(response);
        }
    }
}
jobtracker.config(function ($httpProvider){
    $httpProvider.interceptors.push(interceptor);
})

//Constants
//TODO load from environment via nodejs
jobtracker.constant('urls', {
    BASE_API: 'http://localhost:3001'
})

//Routes
jobtracker.config(['$routeProvider', '$httpProvider',
    function($routeProvider, $httpProvider){
        $routeProvider
            .when('/', {
                templateUrl: 'templates/customers.html',
                controller: 'HomeController'
            })
            .when('/login', {
                templateUrl: 'templates/login.html',
                controller: 'HomeController'
            })
            .when('/a_customer/:id/jobs', {
                templateUrl: 'templates/customer_jobs.html',
                controller: 'HomeController'
            })
            .when('/a_job/:id/tasks', {
                templateUrl: 'templates/job_tasks.html',
                controller: 'HomeController'
            })
}]);

//Controllers
jobtracker.controller('HomeController', ['$route', '$scope', '$http', '$location',  '$cookieStore', '$routeParams', 'urls',
    function($route, $scope, $http, $location, $cookieStore, $routeParams, urls){
        //vm accessible via scope using controllerAs, bindToController:true
        var vm = this;
        $scope.$on('$locationChangeStart',function(evt, currentUrl, previousUrl) {
            //if current url is root then dont set canGoBack = false so back button directive does not go back.
            if (currentUrl.endsWith('#!/')){
                vm.canGoBack = false;
            } else {
                vm.canGoBack = true;
            }
        });

        $scope.userLogin = function(){
            $http.post(urls.BASE_API +'/users/login', {user: $scope.user})
                .then(function (result){
                    //login template
                    //auth check for all calls
                    console.log('userLogin Result: ');
                    console.log(result.data);

                    if (result.status == 200 && result.data.jwt){
                        $cookieStore.put('token', result.data.jwt);
                    }
                    window.location.href='/'
                })
        }

        $scope.userLogout = function(){
            $cookieStore.remove('token');
            window.location.href='/';
        }

        $scope.getCustomers = function(){
            $http.get(urls.BASE_API+'/customers')
                .then(function (result){
                    $scope.customers = result.data;
                })
        }

        $scope.getCustomerJobs = function(){
            var uuid = $routeParams.id;
            $http.get(urls.BASE_API+'/customer/'+ uuid+'/jobs')
                .then(function (result){
                    $scope.customer = result.data.customer;
                    $scope.jobs = result.data.jobs;

                })
        }

        $scope.getJobTasks = function(){
            var uuid = $routeParams.id;
            $http.get(urls.BASE_API+'/job/'+ uuid+'/job_tasks')
                .then(function (result){
                    console.log(result)
                    $scope.job = result.data.job;
                    $scope.pending_tasks = result.data.job_tasks.created;
                    $scope.started_tasks = result.data.job_tasks.started;
                    $scope.finished_tasks = result.data.job_tasks.finished;
                })

            //if reloaded, load with preselected tab. previously stored at a task method
            var tab_selection = localStorage.getItem("task_tab_selection");

            if (tab_selection != null){
                $('.nav-tabs>li>a[data-target='+tab_selection+']').tab('show');
                localStorage.setItem("task_tab_selection", null);
            }
        }

        $scope.getJobTask = function(uuid){
            $http.get(urls.BASE_API+'/job_task/'+ uuid)
                .then(function (result){
                    console.log(result.data);
                    $scope.job_task_detail = result.data;
                    $('#jobTaskDetailsModal').modal('show');
                })
        }

        $scope.addCustomer = function(){
            $http.post(urls.BASE_API+'/customer', {customer: $scope.customer})
                .then(function (result){
                    //do something better about this refresh
                    window.location.href='/'
                })
        }

        $scope.addJob = function(){
            $scope.job.customer_uuid = $scope.customer.uuid

            $http.post(urls.BASE_API+'/job', {job: $scope.job})
                .then(function(result){
                    //$route.reload() modal does not close, should use bootstrap angular ui
                    $('#newCustomerJobModal').modal('hide');
                    $("#newCustomerJobModal").on('hidden.bs.modal', function(){
                        $route.reload();
                    });
                })

        }

        $scope.addJobTask = function(){
            $scope.job_task.job_uuid = $scope.job.uuid

            $http.post(urls.BASE_API+'/job_task', {job_task: $scope.job_task})
                .then(function(result){
                    $('#newJobTaskModal').modal('hide');
                    $('#newJobTaskModal').on('hidden.bs.modal', function(){
                        $route.reload();
                    })

                })
        }

        $scope.startJobTask = function(uuid){
            $http.post(urls.BASE_API+'/job_task/'+uuid+'/start')
                .then(function(){
                    //todo eventually update just the current panel not the whole route
                    $route.reload();
                })
        }

        $scope.finishJobTask = function(uuid){
            $http.post(urls.BASE_API+'/job_task/'+uuid+'/finish')
                .then(function(){
                    //todo eventually update just the current panel not the whole route
                    $route.reload();

                    localStorage.setItem("task_tab_selection", $('.nav-tabs .active > a').attr('data-target') );
                })
        }

        $scope.deleteJobTask = function(uuid){
            $http.delete(urls.BASE_API+'/job_task/'+uuid)
                .then(function(){
                    $route.reload();

                    localStorage.setItem("task_tab_selection", $('.nav-tabs .active > a').attr('data-target') );
                })
        }
    }
])

//Directives
jobtracker.directive("angularBack", ['$window', function(){
    return {
        template: "<button class='btn btn-primary'>Back</button>",
        controller: 'HomeController',
        controllerAs: 'vm',
        bindToController:true,
        link: function(scope, elem, attrs){
            elem.bind('click', function(){
                //todo, back button should not refresh page. instead load previous route
                if (scope.vm.canGoBack){
                    javascript:history.go(-1)
                }

            })
        }
    };
}]);

jobtracker.directive("taskDetailView", [function(){
    return {
        templateUrl: 'templates/_task_details.html'
    }
}])

