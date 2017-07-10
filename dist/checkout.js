
(function(){
"use strict";
angular.module('mx.checkout', [
  'mx/template/checkout/checkout.html',
  'mx/template/checkout/card.html',
  'mx/template/checkout/ibank.html',
  'mx/template/checkout/emoney.html',
  'mx/template/checkout/field-input.html',
  'mx/template/checkout/modal.html'
]);

;
angular.module('mx.checkout').constant('mxCheckoutConfig', {
  fields: {
    card: {
      id: 'card',
      // placeholder: 'Card number',
      text: 'Card number',
      label: true,
      size: '19',
      pattern: '[0-9]{14,19}',
      valid: 'ccard,required'
    },
    expireMonth: {
      id: 'expireMonth',
      placeholder: 'MM',
      text: 'Expiration',
      label: true,
      size: '2',
      pattern: '[0-9]{2}',
      valid: 'exp_date,required',
      expdate: 'expireYear'
    },
    expireYear: {
      id: 'expireYear',
      placeholder: 'YY',
      label: true,
      size: '2',
      pattern: '[0-9]{2}',
      valid: 'exp_date,required',
      expdate: 'expireMonth'
    },
    cvv: {
      id: 'cvv',
      // placeholder: 'CVV',
      text: 'Security Code',
      label: true,
      info:
        'CVV/CVC2 – this 3-digits are security code. It is located in the signature field on the back of your payment card (last three digits)',
      size: '3',
      pattern: '[0-9]{3}',
      valid: 'cvv2,required'
    }
  },
  formMap: ['card', 'expireMonth', 'expireYear', 'cvv'],
  error: {
    required: 'Required field',
    ccard: 'Credit card number is invalid',
    exp_date: 'Invalid expiry date',
    cvv2: 'Incorrect CVV2 format'
  },
  defaultData: {
    tabs: {
      card: {
        id: 'card',
        icons: ['visa', 'master', 'american', 'discover']
      },
      emoney: {
        id: 'emoney',
        icons: []
      },
      ibank: {
        id: 'ibank',
        icons: []
      }
    }
  },
  getData: {
    active_tab: 'card',
    tabs_order: ['card', 'ibank', 'emoney'],
    tabs: {
      card: {
        name: 'Credit or Debit Card'
      },
      emoney: {
        name: 'Electronic money',
        payment_systems: {
          webmoney: {
            name: 'Webmoney'
          }
        }
      },
      ibank: {
        name: 'Internet-banking',
        payment_systems: {
          p24: {
            name: 'Приват24'
          },
          plotva24: {
            name: 'PLATBA 24'
          }
        }
      }
    }
  }
});

;
angular
  .module('mx.checkout')
  .directive('mxCheckout', function() {
    return {
      restrict: 'A',
      templateUrl: 'mx/template/checkout/checkout.html',
      scope: {
        onSubmit: '&'
      },
      controller: function($scope, mxCheckout, $element, $attrs) {
        mxCheckout.init();

        $scope.data = mxCheckout.data;

        $scope.formSubmit = function(cF) {
          return mxCheckout.formSubmit(cF, $scope.onSubmit, $element);
        };

        $scope.selectPaymentSystems = mxCheckout.selectPaymentSystems;
        $scope.stop = mxCheckout.stop;
      }
    };
  })
  .directive('mxFieldInput', function() {
    return {
      restrict: 'A',
      replace: true,
      templateUrl: 'mx/template/checkout/field-input.html',
      scope: {
        model: '=mxFieldInput',
        config: '=',
        formCtrl: '='
      },
      controller: function($scope, mxCheckout) {
        $scope.blur = mxCheckout.blur;
        $scope.focus = mxCheckout.focus;
        $scope.valid = mxCheckout.data.valid;
      }
    };
  })
  .directive('autoFocus', function($timeout) {
    return {
      restrict: 'A',
      link: function(scope, element, attrs, ngModel) {
        scope.$watch(
          attrs.autoFocus,
          function(val) {
            if (angular.isDefined(val) && val) {
              $timeout(function() {
                element[0].focus();
              });
            }
          },
          true
        );
      }
    };
  })
  .directive('mxFieldValid', function(
    mxValidation,
    mxCheckout,
    mxCheckoutConfig
  ) {
    return {
      restrict: 'A',
      require: 'ngModel',
      // scope: {
      //   config: '=mxFieldValid'
      // },
      link: function(scope, element, attrs, ngModel) {
        if (scope.config.valid) {
          angular.forEach(scope.config.valid.split(','), function(valid) {
            // mxValidation.validate(ngModel.$modelValue, valid, setError);
            scope.$watch(
              function() {
                return ngModel.$modelValue;
              },
              function(value) {
                mxValidation.validate(value, valid, setError);
              },
              true
            );

            // ngModel.$formatters.push(function(value) {
            //   mxValidation.validate(value, valid, setError);
            //   return value;
            // });
            //view -> model
            ngModel.$parsers.push(function(value) {
              mxValidation.validate(value, valid, setError);
              return value;
            });
          });
        }

        if (scope.config.expdate) {
          attrs.$observe('expdate', function(value) {
            mxValidation.validate(value, 'exp_date', setError);
          });
        }

        function setError(result, valid) {
          if (result) {
            mxCheckout.data.valid.iconShow[scope.config.expdate] = false;
          } else {
            mxCheckout.data.valid.errorText[ngModel.$name] =
              mxCheckoutConfig.error[valid];
          }
          ngModel.$setValidity(valid, result);
        }
      }
    };
  });

;
angular.module('mx.checkout').filter('trusted', function($sce) {
  return function(url) {
    return $sce.trustAsResourceUrl(url);
  };
});

;
angular
  .module('mx.checkout')
  .provider('mxCheckout', function() {
    var defaultOptions = {
      panelClass: 'panel-checkout',
      alertDangerClass: 'alert-checkout-danger',
      formControlClass: 'form-control-checkout'
    };
    var globalOptions = {};

    return {
      options: function(value) {
        angular.extend(globalOptions, value);
      },
      $get: function(mxCheckoutConfig, mxModal, $q) {
        var data = {
          options: angular.extend({}, defaultOptions, globalOptions),
          config: mxCheckoutConfig,
          card: {},
          emoney: {},
          ibank: {},
          loading: true,
          alert: {},

          valid: {
            errorText: {},
            iconShow: {},
            autoFocus: {}
          }
        };

        return {
          data: data,
          init: init,
          formSubmit: formSubmit,
          stop: stop,
          blur: blur,
          focus: focus,
          selectPaymentSystems: selectPaymentSystems
        };

        function init() {
          angular.forEach(data.config.fields, function(item) {
            item.formControlClass = data.options.formControlClass;
          });
          getData();
        }

        function getData() {
          data.loading = true;
          request().then(
            function(response) {
              angular.merge(data, data.config.defaultData, response);
              data.tabs[data.active_tab].open = true;

              data.loading = false;
            },
            function(error) {
              data.loading = false;
            }
          );
        }

        function request() {
          var deferred = $q.defer();

          setTimeout(function() {
            deferred.resolve(data.config.getData);
          }, 500);

          return deferred.promise;
        }

        function formSubmit(formCtrl, onSubmit, $element) {
          if (formCtrl.$valid) {
            onSubmit({
              formMap: data[getActiveTab()]
            });
            show3DS($element);
          } else {
            var autoFocusFlag = true;
            angular.forEach(data.config.formMap, function(field) {
              if (formCtrl[field].$invalid) {
                if (autoFocusFlag) {
                  autoFocusFlag = false;
                  data.valid.autoFocus[field] = +new Date();
                }

                data.valid.iconShow[field] = true;
              }
            });
            addAlert(
              "Please verify that all card information you've provided is accurate and try again"
            );
          }
        }

        function blur(inputCtrl) {
          if (inputCtrl.$invalid) {
            data.valid.iconShow[inputCtrl.$name] = true;
          }
        }

        function focus(inputCtrl) {
          if (inputCtrl.$invalid) {
            data.valid.iconShow[inputCtrl.$name] = false;
          }
        }

        function selectPaymentSystems(tab, id) {
          tab.selected = id;
          data[tab.id].type = id;
        }

        function stop($event) {
          $event.preventDefault();
          $event.stopPropagation();
        }

        function getActiveTab() {
          var result;
          angular.forEach(data.tabs, function(tab) {
            if (tab.open) {
              result = tab.id;
            }
          });
          return result;
        }

        function addAlert(text, type) {
          data.alert = {
            text: text,
            type: type || data.options.alertDangerClass
          };
        }

        function show3DS($element) {
          mxModal
            .open(
              {
                title: 'Title',
                text: 'Text',
                type: 'success'
              },
              $element
            )
            .result.then(function() {}, function() {});
        }
      }
    };
  })
  .factory('mxValidation', function(mxCheckout) {
    var REGEX_NUM = /^[0-9]+$/,
      REGEX_EMAIL = /^[a-zA-Z0-9.!#$%&amp;'*+\-\/=?\^_`{|}~\-]+@[a-zA-Z0-9\-]+(?:\.[a-zA-Z0-9\-]+)*$/,
      REGEX_NUM_DASHED = /^[\d\-\s]+$/,
      REGEX_URL = /^((http|https):\/\/(\w+:{0,1}\w*@)?(\S+)|)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/,
      REGEX_DEC = /^\-?[0-9]*\.?[0-9]+$/,
      REGEX_RULE = /^(.+?):(.+)$/,
      REGEXP_LUHN_DASHED = /^[\d\-\s]+$/;

    var _validation = {
      required: function(field) {
        var value = field.value;
        return !!value;
      },
      ccard: function(field) {
        if (!REGEXP_LUHN_DASHED.test(field.value)) return false;
        var nCheck = 0,
          nDigit = 0,
          bEven = false;
        var strippedField = field.value.replace(/\D/g, '');
        for (var n = strippedField.length - 1; n >= 0; n--) {
          var cDigit = strippedField.charAt(n);
          nDigit = parseInt(cDigit, 10);
          if (bEven) {
            if ((nDigit *= 2) > 9) nDigit -= 9;
          }
          nCheck += nDigit;
          bEven = !bEven;
        }
        return nCheck % 10 === 0;
      },
      num: function(field) {
        return REGEX_NUM.test(field.value);
      },
      min_length: function(field, length) {
        if (!REGEX_NUM.test(length)) return false;
        return field.value.length >= parseInt(length, 10);
      },
      cvv2: function(field) {
        return (
          _validation.num.call(this, field) &&
          _validation.min_length.call(this, field, 3)
        );
      },
      expiry: function(month, year) {
        var currentTime, expiry;
        if (!(month && year)) {
          return false;
        }
        if (!/^\d+$/.test(month)) {
          return false;
        }
        if (!/^\d+$/.test(year)) {
          return false;
        }
        if (!(1 <= month && month <= 12)) {
          return false;
        }
        if (year.length === 2) {
          if (year < 70) {
            year = '20' + year;
          } else {
            year = '19' + year;
          }
        }
        if (year.length !== 4) {
          return false;
        }
        expiry = new Date(year, month);
        currentTime = new Date();
        expiry.setMonth(expiry.getMonth() - 1);
        expiry.setMonth(expiry.getMonth() + 1, 1);
        return expiry > currentTime;
      },
      exp_date: function(field) {
        return _validation.expiry.call(
          this,
          mxCheckout.data.card.expireMonth,
          mxCheckout.data.card.expireYear
        );
      }
    };

    return {
      validate: function(value, valid, cb) {
        var result = _validation[valid]({ value: value });
        cb(result, valid);
        return result;
      }
    };
  })
  .factory('mxModal', function($uibModal) {
    return {
      open: function(option, $element) {
        return $uibModal.open({
          templateUrl: 'mx/template/checkout/modal.html',
          controller: function($scope, $uibModalInstance) {
            $scope.option = option;

            $scope.url = '';
          },
          appendTo: $element
        });
      }
    };
  });

;
angular.module("mx/template/checkout/card.html", []).run(["$templateCache", function ($templateCache) {
  $templateCache.put("mx/template/checkout/card.html",
    "<div class=\"row\">\n" +
    "    <div class=\"col-xs-12\">\n" +
    "        <div\n" +
    "                ng-if=\"data.alert.text\"\n" +
    "                class=\"alert {{data.alert.type}}\"\n" +
    "                role=\"alert\"\n" +
    "        ><div class=\"alert-inner\">{{data.alert.text}}</div></div>\n" +
    "    </div>\n" +
    "</div>\n" +
    "<div class=\"row\">\n" +
    "    <div class=\"col-xs-7 col-card\">\n" +
    "        <div mx-field-input=\"data.card\" config=\"data.config.fields.card\" form-ctrl=\"cF\"></div>\n" +
    "    </div>\n" +
    "    <div class=\"col-xs-5\">\n" +
    "        <div class=\"row\">\n" +
    "            <div class=\"col-xs-6 col-expire-month\">\n" +
    "                <div mx-field-input=\"data.card\" config=\"data.config.fields.expireMonth\" form-ctrl=\"cF\"></div>\n" +
    "            </div>\n" +
    "            <div class=\"col-xs-6 col-expire-year\">\n" +
    "                <div mx-field-input=\"data.card\" config=\"data.config.fields.expireYear\" form-ctrl=\"cF\"></div>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "\n" +
    "</div>\n" +
    "<div class=\"row\">\n" +
    "    <div class=\"col-xs-4 col-cvv\">\n" +
    "        <div mx-field-input=\"data.card\" config=\"data.config.fields.cvv\" form-ctrl=\"cF\"></div>\n" +
    "    </div>\n" +
    "</div>");
}]);

;
angular.module("mx/template/checkout/checkout.html", []).run(["$templateCache", function ($templateCache) {
  $templateCache.put("mx/template/checkout/checkout.html",
    "<div class=\"loading\" ng-if=\"data.loading\">Loading...</div>\n" +
    "<form ng-if=\"!data.loading\" name=\"cF\" ng-submit=\"formSubmit(cF)\" novalidate>\n" +
    "    <uib-accordion>\n" +
    "        <div\n" +
    "                uib-accordion-group\n" +
    "                class=\"panel {{::data.options.panelClass}}\"\n" +
    "                ng-repeat=\"tabId in ::data.tabs_order\"\n" +
    "                ng-init=\"tab = data.tabs[tabId]\"\n" +
    "                is-open=\"tab.open\"\n" +
    "        >\n" +
    "            <uib-accordion-heading ng-click=\"\">\n" +
    "                <span class=\"tab-icons\">\n" +
    "                    <i class=\"i i-{{::icon}}\" ng-repeat=\"icon in ::tab.icons\" ng-click=\"stop($event)\"></i>\n" +
    "                </span>\n" +
    "                {{::tab.name}}\n" +
    "            </uib-accordion-heading>\n" +
    "            <div  ng-include=\"'mx/template/checkout/' + tab.id + '.html'\"></div>\n" +
    "        </div>\n" +
    "    </uib-accordion>\n" +
    "    <div class=\"lock\"><i class=\"i i-lock\"></i> Your payment info is stored securely</div>\n" +
    "    <hr>\n" +
    "    <div class=\"text-right\"><button type=\"submit\" class=\"btn btn-primary\">Checkout</button></div>\n" +
    "</form>");
}]);

;
angular.module("mx/template/checkout/emoney.html", []).run(["$templateCache", function ($templateCache) {
  $templateCache.put("mx/template/checkout/emoney.html",
    "<div class=\"payment-systems form-group\">\n" +
    "    <div class=\"payment-system\"\n" +
    "         ng-class=\"{\n" +
    "            active: tab.selected === id\n" +
    "         }\"\n" +
    "         ng-repeat=\"(id, value) in tab.payment_systems\"\n" +
    "         aria-selected=\"{{tab.selected === id}}\"\n" +
    "         ng-click=\"selectPaymentSystems(tab, id)\"\n" +
    "    >\n" +
    "        <div class=\"i-payment-system i-{{::id}}\"></div>\n" +
    "        <div>{{::value.name}}</div>\n" +
    "    </div>\n" +
    "</div>");
}]);

;
angular.module("mx/template/checkout/field-input.html", []).run(["$templateCache", function ($templateCache) {
  $templateCache.put("mx/template/checkout/field-input.html",
    "<!--form-group-lg-->\n" +
    "<div class=\"form-group\"\n" +
    "     ng-class=\"{\n" +
    "                'has-error': valid.iconShow[config.id],\n" +
    "                'has-success': formCtrl[config.id].$valid\n" +
    "            }\"\n" +
    ">\n" +
    "    <label\n" +
    "            ng-if=\"::config.label\"\n" +
    "    ><span>{{::config.text}}&nbsp;</span>\n" +
    "        <i ng-if=\"::config.info\" class=\"i i-i\" uib-tooltip=\"{{::config.info}}\" tooltip-placement=\"right\" tooltip-append-to-body=\"true\"></i>\n" +
    "    <input\n" +
    "\n" +
    "            name=\"{{::config.id}}\"\n" +
    "            ng-model=\"model[config.id]\"\n" +
    "            type=\"tel\"\n" +
    "            class=\"form-control {{::config.formControlClass}}\"\n" +
    "\n" +
    "            placeholder=\"{{::config.placeholder}}\"\n" +
    "            ng-pattern=\"::config.pattern\"\n" +
    "\n" +
    "            size=\"{{::config.size}}\"\n" +
    "            maxlength=\"{{::config.size}}\"\n" +
    "            autocomplete=\"off\"\n" +
    "            auto-focus=\"valid.autoFocus[config.id]\"\n" +
    "\n" +
    "            mx-field-valid=\"config\"\n" +
    "            expdate=\"{{model[config.expdate]}}\"\n" +
    "\n" +
    "            ng-blur=\"blur(formCtrl[config.id])\"\n" +
    "            ng-focus=\"focus(formCtrl[config.id])\"\n" +
    "\n" +
    "            uib-tooltip=\"{{valid.errorText[config.id]}}\"\n" +
    "            tooltip-placement=\"bottom\"\n" +
    "            tooltip-append-to-body=\"true\"\n" +
    "            tooltip-trigger=\"'focus'\"\n" +
    "            tooltip-enable=\"{{formCtrl[config.id].$invalid}}\"\n" +
    "    >\n" +
    "    </label>\n" +
    "</div>");
}]);

;
angular.module("mx/template/checkout/ibank.html", []).run(["$templateCache", function ($templateCache) {
  $templateCache.put("mx/template/checkout/ibank.html",
    "<div class=\"payment-systems form-group\">\n" +
    "    <div class=\"payment-system\"\n" +
    "         ng-class=\"{\n" +
    "            active: tab.selected === id\n" +
    "         }\"\n" +
    "         ng-repeat=\"(id, value) in tab.payment_systems\"\n" +
    "         aria-selected=\"{{tab.selected === id}}\"\n" +
    "         ng-click=\"selectPaymentSystems(tab, id)\"\n" +
    "    >\n" +
    "        <div class=\"i-payment-system i-{{::id}}\"></div>\n" +
    "        <div>{{::value.name}}</div>\n" +
    "    </div>\n" +
    "</div>");
}]);

;
angular.module("mx/template/checkout/modal.html", []).run(["$templateCache", function ($templateCache) {
  $templateCache.put("mx/template/checkout/modal.html",
    "<div class=\"modal-header text-{{::option.type}}\">\n" +
    "    <h3 class=\"modal-title\">{{::option.title}}</h3>\n" +
    "</div>\n" +
    "<div class=\"modal-body\">\n" +
    "    {{::option.text}}\n" +
    "    <iframe src=\"{{url | trusted}}\" frameborder=\"0\"></iframe>\n" +
    "</div>");
}]);

})();
//# sourceMappingURL=checkout.js.map