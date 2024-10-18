var express = require("express");
var ejsLayouts = require("express-ejs-layouts");
var microtime = require("microtime");
var crypto = require("crypto");
var app = express();
var nodeBase64 = require("nodejs-base64-converter");
var request = require("request");
var path = require("path");
require("dotenv").config();

app.set("views", path.join(__dirname, "/app_server/views"));
app.set("view engine", "ejs");
app.use(ejsLayouts);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

var merchant_id = process.env.MERCHANT_ID;
var merchant_key = process.env.MERCHANT_KEY;
var merchant_salt = process.env.MERCHANT_SALT;
var basket = JSON.stringify([
  ["Örnek Ürün 1", "18.00", 1],
  ["Örnek Ürün 2", "33.25", 2],
  ["Örnek Ürün 3", "45.42", 1],
]);
var user_basket = nodeBase64.encode(basket);
var merchant_oid = "IN" + microtime.now(); //SHOULD BE UNIQUE
var max_installment = "0";
var no_installment = "1";
var user_ip = "72.14.201.36";
var email = "alperen@forsico.io";
var payment_amount = 100;
var currency = "TL";
var test_mode = "1"; // SHOULD BE 1 ON LIVE
var user_name = "alp.yurtseven";
var user_address = "ANKARA";
var user_phone = "05078932701";

var merchant_ok_url = "http://localhost:3000/ordersuccess";
var merchant_fail_url = "http://localhost:3000/orderfail";
var timeout_limit = 5;
var debug_on = 1; // SHOULD BE 0 ON LIVE
var lang = "en";

app.get("/ordersuccess", (req, res) => {
  res.sendFile("./app_server/views/success.html", { root: __dirname });
});

app.get("/orderfail", (req, res) => {
  res.sendFile("./app_server/views/fail.html", { root: __dirname });
});

app.get("/", function (req, res) {
  var hashSTR = `${merchant_id}${user_ip}${merchant_oid}${email}${payment_amount}${user_basket}${no_installment}${max_installment}${currency}${test_mode}`;
  var paytr_token = hashSTR + merchant_salt;
  var token = crypto
    .createHmac("sha256", merchant_key)
    .update(paytr_token)
    .digest("base64");
  var options = {
    method: "POST",
    url: "https://www.paytr.com/odeme/api/get-token",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    formData: {
      merchant_id: merchant_id,
      merchant_key: merchant_key,
      merchant_salt: merchant_salt,
      email: email,
      payment_amount: payment_amount,
      merchant_oid: merchant_oid,
      user_name: user_name,
      user_address: user_address,
      user_phone: user_phone,
      merchant_ok_url: merchant_ok_url,
      merchant_fail_url: merchant_fail_url,
      user_basket: user_basket,
      user_ip: user_ip,
      timeout_limit: timeout_limit,
      debug_on: debug_on,
      test_mode: test_mode,
      lang: lang,
      no_installment: no_installment,
      max_installment: max_installment,
      currency: currency,
      paytr_token: token,
    },
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);
    var res_data = JSON.parse(body);

    if (res_data.status == "success") {
      res.render("layout", { iframetoken: res_data.token });
    } else {
      res.end(body);
    }
  });
});

app.post("/callback", function (req, res) {
  // ÖNEMLİ UYARILAR!
  // 1) Bu sayfaya oturum (SESSION) ile veri taşıyamazsınız. Çünkü bu sayfa müşterilerin yönlendirildiği bir sayfa değildir.
  // 2) Entegrasyonun 1. ADIM'ında gönderdiğniz merchant_oid değeri bu sayfaya POST ile gelir. Bu değeri kullanarak
  // veri tabanınızdan ilgili siparişi tespit edip onaylamalı veya iptal etmelisiniz.
  // 3) Aynı sipariş için birden fazla bildirim ulaşabilir (Ağ bağlantı sorunları vb. nedeniyle). Bu nedenle öncelikle
  // siparişin durumunu veri tabanınızdan kontrol edin, eğer onaylandıysa tekrar işlem yapmayın. Örneği aşağıda bulunmaktadır.

  var callback = req.body;

  console.log("CALLBACK::", callback);

  // POST değerleri ile hash oluştur.
  paytr_token =
    callback.merchant_oid +
    merchant_salt +
    callback.status +
    callback.total_amount;
  var token = crypto
    .createHmac("sha256", merchant_key)
    .update(paytr_token)
    .digest("base64");

  // Oluşturulan hash'i, paytr'dan gelen post içindeki hash ile karşılaştır (isteğin paytr'dan geldiğine ve değişmediğine emin olmak için)
  // Bu işlemi yapmazsanız maddi zarara uğramanız olasıdır.

  if (token != callback.hash) {
    throw new Error("PAYTR notification failed: bad hash");
  }

  if (callback.status == "success") {
    console.log("PAYMENT SUCCESSFULL", callback);
  } else {
    console.log("PAYMENT FAIL", callback);
  }

  res.send("OK");
});

app.listen(process.env.PORT, function () {
  console.log("Server is running. Port:" + process.env.PORT);
});
