import { hostNameRegexPattern,  } from "../../../src/util-frontend";
import {ucfirst} from "../../../src/util";

describe("Test util-frontend.js", () => {

    describe("hostNameRegexPattern()", () => {
        it('should return a valid regex for non mqtt hostnames', () => {
            const regex = new RegExp(hostNameRegexPattern(false));

            expect(regex.test("www.test.com")).to.be.true;
            expect(regex.test("127.0.0.1")).to.be.true;
            expect(regex.test("192.168.1.156")).to.be.true;
            expect(regex.test(" 192.168.1.145")).to.be.false;
            expect(regex.test("192.168.1.145 ")).to.be.false;
            expect(regex.test(" fe80::3282:3ff:ae28:592")).to.be.false;
            expect(regex.test("fe80::3282:3ff:ae28:592 ")).to.be.false;

            ["mqtt", "mqtts", "ws", "wss"].forEach(schema => {
                expect(regex.test(`${schema}://www.test.com`)).to.be.false;
                expect(regex.test(`${schema}://127.0.0.1`)).to.be.false;
            });
        });
        it('should return a valid regex for mqtt hostnames', () => {
            const hostnameString = hostNameRegexPattern(false);
            console.log('*********', hostnameString, '***********');
            const regex = new RegExp(hostNameRegexPattern(true));

            expect(regex.test("www.test.com")).to.be.true;
            expect(regex.test("127.0.0.1")).to.be.true;
            expect(regex.test("192.168.1.156")).to.be.true;
            expect(regex.test(" 192.168.1.145")).to.be.false;
            expect(regex.test("192.168.1.145 ")).to.be.false;
            expect(regex.test(" fe80::3282:3ff:ae28:592")).to.be.false;
            expect(regex.test("fe80::3282:3ff:ae28:592 ")).to.be.false;

            ["mqtt", "mqtts", "ws", "wss"].forEach(schema => {
                expect(regex.test(`${schema}://www.test.com`)).to.be.true;
                expect(regex.test(`${schema}://127.0.0.1`)).to.be.true;
            });
        });
    });
});

describe('Test ucfirst', () => {
    it('should capitalize the first letter of a string', () => {
        expect(ucfirst('hello')).toBe('Hello');
        expect(ucfirst('world')).toBe('World');
    });

    it('should return an empty string if the input is empty', () => {
        expect(ucfirst('')).toBe('');
    });

    it('should return the input string if it is already capitalized', () => {
        expect(ucfirst('Hello')).toBe('Hello');
        expect(ucfirst('World')).toBe('World');
    });
});
