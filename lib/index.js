const through2 = require('through2');
const duplexer = require('duplexer');
const Parser = require('tap-parser');
const { sprintf } = require('sprintf-js');

const PASSING_CODE = 32
const FAILING_CODE = 31

function isPassing(test) {
    return test && test.ok
}

function isPassingEmpty(test) {
    return test
        && test.ok
        && test.assertions.length === 0
        && /^(tests|pass)\s+\d+$/.test(test.name);
}

function isFailing(test) {
    return test && !/^fail\s+\d+$/.test(test.name);
}

function statusCode(res) {
    return isPassing(res) ? PASSING_CODE : FAILING_CODE;
}

function createTest(name) {
    return {
        name: name,
        assertions: [],
        offset: 0,
        ok: true
    }
}

function faucet(opts) {
    const width = opts && opts.width > 0
        ? opts.width
        : undefined;

    let test;
    const tap = new Parser();
    const out = through2();

    function isTextTooWide(s) {
        return s.length > width - 2;
    }

    const trim = width > 0
        ? (s) => (isTextTooWide(s) ? `${s.slice(0, width - 5)}...` : s)
        : (s) => s;

    function addLabels (index, text, code) {
        return `\x1b[${
            index
        }A\x1b[1G\x1b[1m\x1b[${
            code
        }m${
            trim(text)
        }\x1b[0m\x1b[${
            index
        }B\x1b[1G`;
    }

    function onExtra(extra) {
        if (!test || test.assertions.length === 0) {
            return;
        }

        const last = test.assertions[test.assertions.length - 1];

        if (!isPassing(last)) {
            out.push(`${extra.split('\n').map((line) => `  ${line}`).join('\n')}\n`);
        }
    }

    function onAssert(res) {
        const code = statusCode(res)

        if (!test) {
            // mocha produces TAP results this way, whatever
            const s = trim(res.name.trim());
            out.push(sprintf(
                `\x1b[1m\x1b[${code}m%s\x1b[0m\n`,
                trim((res.ok ? '✓' : '⨯') + ' ' +  s)
            ));
            return;
        }
        
        let str = sprintf(
            `\r  %s \x1b[1m\x1b[${code}m%d\x1b[0m %s\x1b[K`,
            isPassing(res) ? 'ok' : 'not ok',
            res.id,
            res.name
        );
        
        if (!isPassing(res)) {
            const y = (++ test.offset) + 1;
            str += '\n';
            if (isPassing(test)) {
                str += addLabels(y, `⨯ ${test.name}`, FAILING_CODE)
            }
            test.ok = false;
        }

        out.push(str);
        test.assertions.push(res);
    }

    function onResults(res) {
        if (isFailing(test)) {
            out.push(addLabels(test.offset + 1, `⨯ ${test.name}`, FAILING_CODE));
        } else if (isPassing(test)) {
            out.push(addLabels(test.offset + 1, `✓ ${test.name}`, PASSING_CODE));
        }
        
        res.errors.forEach((err, ix) => {
            out.push(sprintf(
                'not ok \x1b[1m\x1b[31m%d\x1b[0m %s\n',
                ix + 1 + res.asserts.length, err.message
            ));
        });
        
        if (!isPassing(res) && !isFailing(test)) {
            out.push(sprintf(
                '\r\x1b[1m\x1b[31m⨯ fail  %s\x1b[0m\x1b[K\n',
                (res.errors.length + res.fail.length) || ''
            ));
        }
        
        out.push(null);
        
        dup.emit('results', res);
        if (!isPassing(res)) dup.emit('fail');
        dup.exitCode = res.ok ? 0 : 1;
    }
    
    function onComment(comment) {
        if (comment === 'fail 0') {
            return; // a mocha thing
        } else if (isPassingEmpty(test)) {
            out.push(`\r${trim(test.name)}`);
        } else if (isPassing(test)) {
            const s = addLabels(test.offset + 1, `✓ ${test.name}`, PASSING_CODE);
            out.push(`\r${s}`);
        }
        
        test = createTest(comment);

        out.push(`\r${trim(`# ${comment}`)}\x1b[K\n`);
    }

    const dup = duplexer(tap, out);

    tap.on('comment', onComment);
    tap.on('assert', onAssert);
    tap.on('extra', onExtra);
    tap.on('results', onResults);
    
    return dup;
}

module.exports = faucet
