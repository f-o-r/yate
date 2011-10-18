
// Base AST class.

// ----------------------------------------------------------------------------------------------------------------- //

Yate.AST = function() {};

Yate.AST._asts = {};

// ----------------------------------------------------------------------------------------------------------------- //

Yate.AST.prototype.options = {};

Yate.AST.prototype.Rid = 0;
Yate.AST.prototype.Cid = 0;

Yate.AST.prototype._init = function() {};

// ----------------------------------------------------------------------------------------------------------------- //

Yate.AST.prototype.error = function(s) {
    require('util').puts(new Error().stack);
    throw 'ERROR: ' + s + '\n' + Yate.Parser._where(this.where);
};

// ----------------------------------------------------------------------------------------------------------------- //

Yate.AST.make = function(id) {
    var ast = new (Yate.AST.$(id))();
    ast.id = id; // Если делать это в прототипе, то не видно в console.log.
    ast._init.apply(ast, Array.prototype.slice.call(arguments, 1));
    return ast;
};

Yate.AST.prototype.make = function() {
    var ast = Yate.AST.make.apply(null, arguments);
    ast.parent = this;
    ast.setLocals();
    return ast;
};


Yate.AST.$ = function(id) {
    var ast = this._asts[id];

    if (!ast) {

        ast = function() {};

        var info = Yate.AST[id] || {};
        var options = info.options = info.options || {};

        var base = (options.base) ? this.$(options.base) : Yate.AST;
        var mixin = [];
        if (options.mixin) {
            options.mixin = Yate.Common.makeArray(options.mixin);
            mixin = mixin.concat(Yate.Common.map(options.mixin, function(id) { return Yate.AST[id] || {}; }));
        }
        mixin.push(info);
        Yate.Common.inherits(ast, base, mixin);

        this._asts[id] = ast;
    }

    return ast;
};

// ----------------------------------------------------------------------------------------------------------------- //

Yate.AST.prototype.yate = function(id, data, mode) {
    return this._yate(id, data, mode);
};

Yate.AST.prototype._yate = function(id, data, mode) {
    return this._fill('yate', id, data, mode);
};

Yate.AST.prototype.js = function(id, data, mode) {
    return this._js(id, data, mode);
};

Yate.AST.prototype._js = function(id, data, mode) {
    return this._fill('js', id, data, mode);
};

Yate.AST.prototype._fill = function(type, id, data, mode) {
    if (typeof id == 'object') {
        data = id.data;
        mode = id.mode;
        id = id.id;
    }

    id = id || this.id;
    data = data || this;
    mode = mode || '';

    return CodeTemplates.fill(type, id, mode, data, type);
};

// ----------------------------------------------------------------------------------------------------------------- //

Yate.AST.prototype.childrenKeys = function() {
    var keys = [];
    var order = this.options.order;
    if (order) {
        for (var i = 0, l = order.length; i < l; i++) {
            keys.push(order[i]);
        }
    } else {
        for (var key in this) {
            if (this.hasOwnProperty(key) && /^[A-Z]/.test(key)) {
                keys.push(key);
            }
        }
    }
    return keys;
};

Yate.AST.prototype.children = function() {
    var children = [];

    var keys = this.childrenKeys();
    for (var i = 0, l = keys.length; i < l; i++) {
        var key = keys[i];
        var child = this[key];
        if (child !== undefined) {
            children.push( this[key] );
        }
    }

    return children;
    /*
    var order = this.options.order;
    if (order) {
        for (var i = 0, l = order.length; i < l; i++) {
            children.push(this[order[i]]);
        }
    } else {
        for (var key in this) {
            if (this.hasOwnProperty(key) && /^[A-Z]/.test(key)) {
                children.push(this[key]);
            }
        }
    }
    return children;
    */
};

Yate.AST.prototype._apply = function(callback) {
    var args = Array.prototype.slice.call(arguments, 1);

    var children = this.children();
    for (var i = 0, l = children.length; i < l; i++) {
        step(children[i]);
    }

    function step(child) {
        if (child instanceof Array) {
            for (var j = 0, m = child.length; j < m; j++) {
                step(child[j]);
            }
        } else if (child instanceof Yate.AST) {
            callback.apply(child, args);
        }
    }
};

Yate.AST.prototype.trigger = function(method) {
    var args = Array.prototype.slice.call(arguments, 1);

    run.apply(this, args);

    function run() {
        var callback;
        if ((typeof method == 'function')) {
            callback = method;
        } else if (typeof method == 'string' && typeof this[method] == 'function') {
            callback = this[method];
        }
        var args = Array.prototype.slice.call(arguments);
        if (callback) {
            callback.apply(this, args);
        }
        this._apply.apply(this, [ run ].concat(args));
    };
};

// ----------------------------------------------------------------------------------------------------------------- //

Yate.AST.prototype.setParents = function() {
    function set(parent) {
        this.parent = parent;
        this._apply(set, this);
    }

    set.call(this, null);
};

// ----------------------------------------------------------------------------------------------------------------- //
// Type methods
// ----------------------------------------------------------------------------------------------------------------- //

Yate.AST.prototype.type = function(to) {
    var type = this._type;
    if (type === undefined) {
        type = this._type = this._getType();
    }

    return (to) ? Yate.Types.convertable(type, to) : type;
};

Yate.AST.prototype._getType = function() {
    return Yate.Types.NONE;
};

Yate.AST.prototype.cast = function(to) {
    var from = this.type();
    to = to || from;

    if (from != to) {
        this.AsType = to;

        if (!Yate.Types.convertable(from, to)) {
            this.error('Cannot convert type from ' + from + ' to ' + to + ' ' + this.id);
        }
    }

    this.oncast(to);
};

Yate.AST.prototype.oncast = function(to) {
    // Do nothing.
};

Yate.AST.prototype.toValue = function() {
    var type = this.type();

    if (type == Yate.Types.ARRAY || type == Yate.Types.OBJECT) {
        this.cast(type);
    } else {
        this.cast(Yate.Types.XML);
    }
};

Yate.AST.prototype.is = function(type) {
    if (type instanceof Array) {
        for (var i = 0, l = type.length; i < l; i++) {
            if (this instanceof Yate.AST.$(type[i])) {
                return true;
            }
        }
    } else {
        return this instanceof Yate.AST.$(type);
    }
};

Yate.AST.prototype.inline = function() {
    return false;
};

// ----------------------------------------------------------------------------------------------------------------- //
// Locals: state, context, scope
// ----------------------------------------------------------------------------------------------------------------- //

Yate.AST.Local = function() {
};

Yate.AST.Local.prototype.child = function() {
    var local = new this.constructor();
    local.parent = this;
    return local;
};

// ----------------------------------------------------------------------------------------------------------------- //

Yate.AST.Local.State = function() {
    this.jpaths = [];
    this.jkeys = {};

    this.predicates = [];
    this.pkeys = {};

    // Глобальные id-шники:
    this.jid = 0; // jpath'ы.
    this.pid = 0; // Предикаты.
    this.tid = 0; // Шаблоны.
    this.vid = 0; // Переменные.
    this.fid = 0; // Функции.
    this.kid = 0; // Ключи.
};

Yate.Common.inherits(Yate.AST.Local.State, Yate.AST.Local);

// ----------------------------------------------------------------------------------------------------------------- //

Yate.AST.Local.Context = function() {
};

Yate.Common.inherits(Yate.AST.Local.Context, Yate.AST.Local);

// ----------------------------------------------------------------------------------------------------------------- //

Yate.AST.Local.Scope = function() {
    this.vars = {};
    this.functions = {};
    this.id = Yate.AST.Local.Scope._id++;
};

Yate.AST.Local.Scope._id = 0;

Yate.Common.inherits(Yate.AST.Local.Scope, Yate.AST.Local);

Yate.AST.Local.Scope.prototype.findVar = function(name) {
    var scope = this;
    while (scope) {
        var value = scope.vars[name];
        if (value) {
            return value;
        }
        scope = scope.parent;
    }
};

Yate.AST.Local.Scope.prototype.findFunction = function(name) {
    var scope = this;
    while (scope) {
        var value = scope.functions[name];
        if (value) {
            return value;
        }
        scope = scope.parent;
    }
    return Yate.AST.internalFunctions[name]; // Если ничего не нашли в scope'ах, смотрим на список встроенных функций.
};

// ----------------------------------------------------------------------------------------------------------------- //

Yate.AST.locals = {
    state: Yate.AST.Local.State,
    context: Yate.AST.Local.Context,
    scope: Yate.AST.Local.Scope
};

// ----------------------------------------------------------------------------------------------------------------- //
// Walk methods
// ----------------------------------------------------------------------------------------------------------------- //

Yate.AST.prototype.setLocals = function() {
    var options = this.options.locals || {};
    var locals = Yate.AST.locals;
    var parent = this.parent;

    for (var local in locals) {
        var parentLocal = (parent) ? parent[local] : null;
        if (options[local]) {
            this[local] = (parentLocal) ? parentLocal.child() : new locals[local]();
        } else {
            this[local] = parentLocal;
        }
    }

    this.Sid = this.scope.id;
};

// ----------------------------------------------------------------------------------------------------------------- //

Yate.AST.prototype.log = function() {
    // console.log(this.id);
    return require('util').inspect(this, true, null);
};

// ----------------------------------------------------------------------------------------------------------------- //

Yate.AST.prototype.set = function(key, value) {
    this.trigger(function() {
        this[key] = value;
    });
};

Yate.AST.prototype.rid = function() {
    this.set('Rid', this.Rid + 1);
};

Yate.AST.prototype.cid = function() {
    this.set('Cid', this.Cid + 1);
};

// ----------------------------------------------------------------------------------------------------------------- //

Yate.AST.prototype.isOpen = function() {
    if (this.type() == Yate.Types.ATTR || this.type() == Yate.Types.XML) {
        return undefined;
    }
    return false;
};

// ----------------------------------------------------------------------------------------------------------------- //
// Items
// ----------------------------------------------------------------------------------------------------------------- //

Yate.AST.items = {

    _init: function(items) {
        this.Items = Yate.Common.makeArray(items || []);
    },

    _getType: function() {
        var items = this.Items;
        var l = items.length;

        if (!l) { return Yate.Types.SCALAR; } // FIXME: А нужно ли это? Может быть UNDEF сработает?

        var type = items[0].type();

        for (var i = 1; i < l; i++) {
            var item = items[i];
            type = Yate.Types.joinType(type, item.type());
            if (type == Yate.Types.NONE) {
                item.error('Несовместимые типы ' + this.id); // FIXME
            }
        };

        return type;
    },

    add: function(item) {
        this.Items.push(item);
    },

    last: function() {
        var items = this.Items;
        return items[items.length - 1];
    },

    empty: function() {
        return (this.Items.length == 0);
    },

    iterate: function(callback) {
        var items = this.Items;
        for (var i = 0, l = items.length; i < l; i++) {
            callback(items[i], i);
        }
    },

    grep: function(callback) {
        var items = this.Items;
        var r = [];
        for (var i = 0, l = items.length; i < l; i++) {
            var item = items[i];
            if (callback(item, i)) {
                r.push(item);
            }
        }
        return r;
    },

    map: function(callback) {
        return Yate.Common.map(this.Items, callback);
    },

    yate: function() {
        var options = this.options.yate || {};
        return this.map('yate').join(options.separator || '');
    },

    js: function(id, data, mode) {
        mode = mode || ((typeof id == 'object') ? id.mode : '') || '';

        var options = this.options.js || {};
        var r = [];
        this.iterate(function(item) {
            r.push(item.js(id, data, mode));
        });
        return r.join( ((mode) ? options['separator$' + mode] : options.separator) || '');
    },

    toResult: function(result) {
        this.iterate(function(item) {
            item.toResult(result);
        });
    },

    toString: function() {
        if (this.Items.length > 0) {
            var r = this.Items.join('\n').replace(/^/gm, '    ');
            return this.id.bold + ' [\n' + r + '\n]';
        }
        return '';
    },

    oncast: function(to) {
        this.iterate(function(item) {
            item.cast(to);
        });
    }

};

// ----------------------------------------------------------------------------------------------------------------- //

Yate.AST.prototype.toString = function() {
    var r = [];
    var keys = this.childrenKeys();
    for (var i = 0, l = keys.length; i < l; i++) {
        var key = keys[i];
        var child = this[key];
        if (child !== undefined) {
            if (child instanceof Yate.AST) {
                var s = child.toString();
                if (s) {
                    r.push( key.blue.bold + ': ' + s);
                }
            } else {
                r.push( key.blue.bold + ': ' + JSON.stringify(child) );
            }
        }
    }
    if (r.length) {
        var s = this.id.bold + '( ' + this.type().lime;
        if (this.AsType) {
            s += ' -> '.lime + this.AsType.lime;
        }
        s += ' )\n' + r.join('\n').replace(/^/gm, '    ');
        return s;
    }
    return '';
};

// ----------------------------------------------------------------------------------------------------------------- //

Yate.AST.var_type = {
    USER: 'user',
    ARGUMENT: 'argument'
};

Yate.AST.function_type = {
    USER: 'user',
    INTERNAL: 'internal',
    EXTERNAL: 'external',
    KEY: 'key'
};
