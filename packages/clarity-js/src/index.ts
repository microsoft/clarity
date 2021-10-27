import * as clarity from "./clarity";
import hash from "./core/hash";
import selector from "./layout/selector";
import { get, getNode } from "./layout/dom";

const helper = { hash, selector, get, getNode }
const version = clarity.version;

export { clarity, version, helper };
