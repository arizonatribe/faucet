const through2 = require('through2');
const duplexer = require('duplexer');
const Parser = require('tap-parser');
const { sprintf } = require('sprintf-js');

function faucet(opts) {
    if (!opts) {
        opts = {};
    }

    let test;
    const tap = new Parser();
    const out = through2();

    function trim(s) {
        if (opts.width && s.length > opts.width - 2) {
            s = s.slice(0, opts.width - 5) + '...';
        }
        return s;
    }
    
    function updateName (y, str, c) {
        return '\x1b[' + y + 'A'
            + '\x1b[1G'
            + '\x1b[1m\x1b[' + c + 'm'
            + trim(str)
            + '\x1b[0m'
            + '\x1b[' + y + 'B\x1b[1G'
        ;
    }
    
    tap.on('comment', function (comment) {
        if (comment === 'fail 0') return; // a mocha thing
        
        if (test && test.ok && test.assertions.length === 0
        && /^(tests|pass)\s+\d+$/.test(test.name)) {
            out.push('\r' + trim(test.name));
        }
        else if (test && test.ok) {
            var s = updateName(test.offset + 1, '✓ ' + test.name, 32);
            out.push('\r' + s);
        }
        
        test = {
            name: comment,
            assertions: [],
            offset: 0,
            ok: true
        };
        out.push('\r' + trim('# ' + comment) + '\x1b[K\n');
    });
    
    tap.on('assert', function (res) {
        const ok = res.ok ? 'ok' : 'not ok';
        const c = res.ok ? 32 : 31;
        if (!test) {
            // mocha produces TAP results this way, whatever
            const s = trim(res.name.trim());
            out.push(sprintf(
                '\x1b[1m\x1b[' + c + 'm%s\x1b[0m\n',
                trim((res.ok ? '✓' : '⨯') + ' ' +  s)
            ));
            return;
        }
        
        const fmt = '\r  %s \x1b[1m\x1b[' + c + 'm%d\x1b[0m %s\x1b[K';
        let str = sprintf(fmt, ok, res.id, res.name);
        
        if (!res.ok) {
            const y = (++ test.offset) + 1;
            str += '\n';
            if (test.ok) {
                str += updateName(y, '⨯ ' + test.name, 31)
            }
            test.ok = false;
        }
        out.push(str);
        test.assertions.push(res);
    });
    
    tap.on('extra', function (extra) {
        if (!test || test.assertions.length === 0) return;
        const last = test.assertions[test.assertions.length-1];
        if (!last.ok) {
            out.push(extra.split('\n').map(function (line) {
                return '  ' + line;
            }).join('\n') + '\n');
        }
    });
    
    tap.on('results', function (res) {
        if (test && /^fail\s+\d+$/.test(test.name)) {
            out.push(updateName(test.offset + 1, '⨯ ' + test.name, 31));
        }
        else if (test && test.ok) {
            out.push(updateName(test.offset + 1, '✓ ' + test.name, 32));
        }
        
        res.errors.forEach(function (err, ix) {
            out.push(sprintf(
                'not ok \x1b[1m\x1b[31m%d\x1b[0m %s\n',
                ix + 1 + res.asserts.length, err.message
            ));
        });
        
        if (!res.ok && !/^fail\s+\d+$/.test(test && test.name)) {
            out.push(sprintf(
                '\r\x1b[1m\x1b[31m⨯ fail  %s\x1b[0m\x1b[K\n',
                (res.errors.length + res.fail.length) || ''
            ));
        }
        
        out.push(null);
        
        dup.emit('results', res);
        if (!res.ok) dup.emit('fail');
        dup.exitCode = res.ok ? 0 : 1;
    });
    
    const dup = duplexer(tap, out);
    return dup;
}

module.exports = faucet
