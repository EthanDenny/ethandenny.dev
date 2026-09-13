---
title: "Adventures with microcontrollers"
date: 2026-09-12
---

> Adapted from a presentation I gave at [Demo Night 5](https://demo-night.fly.dev)

## What even is a microcontroller?

According to the Google slop, it is “a tiny, self-contained computer on a single integrated circuit chip designed to govern specific operations in embedded systems.”

Technically correct. In practice, it is a tiny, cheap computer that you can plug into things:

- An Arduino: yes
- A Raspberry Pi: kinda
- The little computer hiding inside your toaster: probably

<img
  class="image-medium image-center"
  src="/images/adventures-with-microcontrollers/arduino-uno.png"
  alt="An Arduino Uno microcontroller board"
/>

## Why I like them

- They make it easy to play with hardware (especially if you're mostly a software guy)
- They're really cheap
- Most of them just plug into another machine, which lets you start fast

There is almost no ceremony. Plug one in, change a few lines of code, and suddenly your software is doing something in the physical world.

## This is Steve

<img
  class="image-small image-center"
  src="/images/adventures-with-microcontrollers/steve-ruiz.png"
  alt="Steve Ruiz"
/>

[Steve Ruiz](https://x.com/steveruizok) makes playful software and posts experiments that make new projects look dangerously approachable. This node-based workflow got my attention:

<img
  class="image-medium image-center"
  src="/images/adventures-with-microcontrollers/steve-ruiz-workflow.png"
  alt="A node-based workflow made by Steve Ruiz"
/>

Then he recommended a particular ESP32 development board.

## The tweet that cost me $50 and many hours of my life

![Steve Ruiz recommending an ESP32-S3 development board](/images/adventures-with-microcontrollers/tweet-that-cost-50.png)

The path from “look at this neat thing” to “I should order one” was very short.

## The device / instrument / thingy

What arrived looks like a tiny smartwatch, but it is really an ESP32-S3 development board with an AMOLED touchscreen, Wi-Fi, Bluetooth, motion sensors, and a USB-C port. It is small enough to disappear into a project and capable enough to become the whole project.

<div class="image-row">
  <img
    class="image-crop"
    src="/images/adventures-with-microcontrollers/waveshare-product-page.png"
    alt="The ESP32-S3 AMOLED development board product page"
  />
  <img
    class="image-crop"
    src="/images/adventures-with-microcontrollers/esp32-device.png"
    alt="The ESP32-S3 AMOLED development board connected by USB-C"
  />
</div>

It is not a finished product. That is the fun part. You get a screen, a processor, and a pile of possibilities.

## A lot of people are building things

I was not the only person who took Steve's advice. Michael Becker turned his into a tiny home-lab monitor. Adan Ordonez built a working Pokédex in two days.

<div class="image-row">
  <img
    class="image-crop"
    src="/images/adventures-with-microcontrollers/michael-becker-build.png"
    alt="Michael Becker's home-lab monitor built with the ESP32-S3 board"
  />
  <img
    class="image-crop"
    src="/images/adventures-with-microcontrollers/adan-ordonez-pokedex.png"
    alt="Adan Ordonez's Pokédex built with the ESP32-S3 board"
  />
</div>

## I am also building things

I started with a little physics simulation, complete with a Spellbook gem 💎

<https://x.com/ethanisthinking/status/2089086672944189789?s=20>

It is not especially useful yet. That is not really the point. Microcontrollers make it cheap and easy to follow an idea until it becomes a real thing you can hold—and that is a very fun way to spend a few hours.
