import * as livechat from "@src/dynamic/agent/livechat";
import * as tidio from "@src/dynamic/agent/tidio";
import * as crisp from "@src/dynamic/agent/crisp";
(function () {
  livechat.start();
  tidio.start();
  crisp.start();
})();
