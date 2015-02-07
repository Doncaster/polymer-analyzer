/*
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
* This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
* The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
* The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
* Code distributed by Google as part of the polymer project is also
* subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/
/**
* Finds and annotates the Polymer() and modulate() calls in javascript.
*/
(function(context){
  "use strict"
  var esprima = require('esprima');
  var estraverse = require('estraverse');

  /**
   * The list of modules exported by each traversed script.
   */
  var modules;

  /**
   * The list of elements discovered in each traversed script.
   */
  var elements;

  /**
   * The module being built during a traversal;
   */
  var module;


  /**
   * The element being built during a traversal;
   */
  var element;

  var visitors = {
    enterCallExpression: function enterCallExpression(node, parent) {
      var callee = node.callee;
      if (callee.type == "Identifier") {
        if (callee.name == "modulate") {
          module = {};
          // modulate('module-name', {});
          module.is = node.arguments[0].value;

          var deps = [];
          if (node.arguments.length > 2) {
            var args = node.arguments[1].elements;
            var strippedArgs = [];
            for (var i = 0; i < args.length; i++) {
              var arg = args[i];
              strippedArgs.push(arg.value);
            }
            deps = deps.concat(strippedArgs);
            console.log(deps);
            module.deps = deps;
          }
          var comments = parent.leadingComments;
          if (comments && comments.length > 0) {
            module.desc = comments[comments.length-1].value;
          }
        }
      } else {
        //console.log(node);
      }
    },
    leaveCallExpression: function leaveCallExpression(node, parent) {
      var callee = node.callee;
      if (callee.type == "Identifier") {
        if (callee.name == "modulate") {
          if (module) {
            modules.push(module);
            module = undefined;
          }
        }
      }
    },
    enterFunctionExpression: function enterFunctionExpression(node, parent) {
      console.log(node);
      // Check to see if we're in a module with uninitialized args;
      if (module && module.deps && module.deps.length > 0 && module.depAliases === undefined) {
        if (node.params.length !== module.deps.length) {
          throw {
            message: "Params to function expression don't match dependency list.",
            location: node.loc.start
          }
        }
        module.depAliases = [];
        for (var i = 0; i < node.params.length; i++) {
          var param = node.params[i];
          module.depAliases.push(param.name)
        }
      }
    },
    leaveFunctionExpression: function leaveFunctionExpression(node, parent) {

    },
    enterObjectExpression: function enterObjectExpression(node, parent) {
      if (module && module.properties === undefined) {
        module.properties = [];
        for (var i = 0; i < node.properties.length; i++) {
          var property = {};
          var prop = node.properties[i];
          if (prop.value.type == "FunctionExpression") {
            property.type = "function";
          }
        }
        return estraverse.VisitorOption.Skip;
      }
    }
  };

  var visitor;
  // ESTraverse visitor
  var traverse = {
    enter: function(node, parent) {
      visitor = "enter" + node.type;
      if (visitor in visitors) {
        visitors[visitor](node, parent);
      }
    },
    leave: function(node, parent) {
      visitor = "leave" + node.type;
      if (visitor in visitors) {
        visitors[visitor](node, parent);
      }
    }
  }

  var jsParse = function jsParse(jsString){
    var script = esprima.parse(jsString, {attachComment: true, comment: true, loc: true});
    modules = [];
    elements = [];
    estraverse.traverse(script, traverse);
    return {modules: modules, elements: elements};
  };

  context.exports = jsParse;
}(module));