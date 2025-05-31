const files = require('fs');
const types = require("@babel/types");
const parser = require("@babel/parser");
const template = require("@babel/template").default;
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;
const NodePath = require("@babel/traverse").NodePath;


class GeeTest {
    constructor(file_path) {
        this.ast = parser.parse(files.readFileSync(file_path, "utf-8"));
        this.decodeStr = [];
        this.decodeFunc = {};
    }

    save_file() {
        const {code: newCode} = generator(this.ast);
        files.writeFileSync(
            './gt/decode.js',
            newCode,
            "utf-8"
        );
    }

    fix_code() {
        traverse(this.ast, {
            Literal: (path) => {
                if (!types.isStringLiteral(path.node)) return;
                if (!path.node.extra.raw.includes('\\u0')) return;
                let str = JSON.parse(path.node.extra.raw);
                path.node.value = str;
                path.node.extra = {raw: str, rawValue: `"${str}"`}
            }
        })
    }

    convert_code() {

        function lst(ast, result, uc, key) {
            if (key !== 'fun') {
                traverse(ast, {
                AssignmentExpression(path) {
                    const {left, operator, right} = path.node;

                    if (!types.isMemberExpression(left)) return;
                    if (operator !== '=') return;
                    if (!types.isCallExpression(right)) return;
                    if (right.params && right.params.length !== 0) return;

                    if (generator(left).code !== uc) return;

                    const code = generator(path.node).code;
                    result.push(code);
                    path.stop();
                }
            });
                return result;
            }
            traverse(ast, {
                FunctionDeclaration: (path) => {
                    let {id, params, body} = path.node;
                    if (id.name !== uc) return;
                    let jv = generator(path.node).code;
                    result.push(jv);
                    path.stop()
                }
            });
            return result
        }

        traverse(this.ast, {
            CallExpression: (path) => {
                let {callee, arguments: args} = path.node;
                if (!types.isIdentifier(callee)) return;
                if (callee.name.length === 1) return;
                if (args.length !== 1) return;
                if (!types.isNumericLiteral(args[0])) return;
                let ws = path.scope.getBinding(callee.name).path;
                if (types.isFunctionDeclaration(ws.node)) return;
                if (!types.isVariableDeclarator(ws.node)) return;
                let qs = generator(ws.parent.declarations[0].init).code;
                let uv = [];
                uv.push(path.node);
                uv.push(qs);
                this.decodeStr.push(uv);
            }
        });
        traverse(this.ast, {
            AssignmentExpression: (path) => {
                let {left, operator, right} = path.node;
                if (!types.isMemberExpression(left)) return;
                if (operator !== '=') return;
                if (!types.isFunctionExpression(right)) return;
                if (right.params.length !== 0) return;
                if (!types.isReturnStatement(right.body.body[0])) return;
                let im = [];
                let am = left.object.name;
                im = lst(this.ast, im, am, 'fun');
                let el = generator(left).code;
                let sk = generator(path.node).code;
                im.push(sk);
                let uc = generator(right.body.body[0].argument.consequent.arguments[0]).code;
                im = lst(this.ast, im, uc, 'ass');
                this.decodeFunc[el] = im[0] + '\n' + im[1] + '\n' + im[2] + '\n';
            }
        });
    }

    trans_code() {
        this.decodeStr.forEach(res => {
            traverse(this.ast, {
                CallExpression: (path) => {
                    let {callee, arguments: args} = path.node;
                    if (!types.isIdentifier(callee)) return;
                    if (callee.name !== res[0].callee.name) return;
                    let transCode = this.decodeFunc[res[1]] + res[1] + `(${res[0].arguments[0].value})`;
                    let str = eval(transCode);
                    path.replaceWith(types.stringLiteral(str));
                    path.stop();
                }
            })
        })
    }


    start() {
        this.fix_code();
        this.convert_code();
        this.trans_code();
        this.save_file();
    }

}

console.time('处理完毕，耗时');

let gt_ast = new GeeTest('./gt/fullcode.js');
gt_ast.start();


console.timeEnd('处理完毕，耗时');



