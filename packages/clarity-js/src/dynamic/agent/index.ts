import * as livechat from "@src/dynamic/agent/livechat";
import * as tidio from "@src/dynamic/agent/tidio";
import * as crisp from "@src/dynamic/agent/crisp";
import * as brandagent from "@src/dynamic/agent/brandagent";
(function () {
  livechat.start();
  tidio.start();
  crisp.start();
  brandagent.start();
})();
