<script lang="ts">
    // A plain, single-color Outpost pictograph (from the game's own Outpost icon art, provided
    // by the co-designer as a vector PDF) - unlike CorporationOutpostIcons' per-corporation
    // wooden-piece renders, this one isn't tied to any Corporation's color, for places that need
    // to show "an Outpost" as a generic concept (e.g. Expand Network's Outpost Cost legend).
    // Inline SVG (fill: currentColor) rather than a raster image so it always matches whatever
    // text color it sits next to without needing separate light/dark variants. Sized in em units
    // using the source art's own aspect ratio (14.3548 x 15.8243) so it's never stretched.
    let { color = 'currentColor' }: { color?: string } = $props()
</script>

<svg
    viewBox="0 0 14.3548 15.8243"
    class="inline-block shrink-0 align-[-0.15em]"
    style="height: 0.95em; width: calc(0.95em * 14.3548 / 15.8243); fill: {color};"
>
    <path
        d="M 13.738281 8.410156 C 13.738281 9.269531 10.664062 9.964844 6.867188 9.964844 C 3.074219 9.964844 0 9.269531 0 8.410156 C 0 7.554688 3.074219 6.855469 6.867188 6.855469 C 10.664062 6.855469 13.738281 7.554688 13.738281 8.410156 "
    />
    <path
        d="M 10.28125 11.777344 C 10.28125 12.339844 8.753906 12.796875 6.867188 12.796875 C 4.984375 12.796875 3.457031 12.339844 3.457031 11.777344 C 3.457031 11.214844 4.984375 10.761719 6.867188 10.761719 C 8.753906 10.761719 10.28125 11.214844 10.28125 11.777344 "
    />
    <path
        d="M 12.070312 5.042969 C 12.070312 5.691406 9.742188 6.21875 6.867188 6.21875 C 3.996094 6.21875 1.667969 5.691406 1.667969 5.042969 C 1.667969 4.390625 3.996094 3.867188 6.867188 3.867188 C 9.742188 3.867188 12.070312 4.390625 12.070312 5.042969 "
    />
    <path
        d="M 6.390625 0.574219 C 5.628906 1.359375 5.253906 2.429688 5.367188 3.507812 L 6.554688 14.976562 C 6.613281 15.539062 7.125 15.539062 7.179688 14.976562 L 8.371094 3.507812 C 8.480469 2.429688 8.109375 1.359375 7.347656 0.574219 L 7.160156 0.378906 C 7 0.214844 6.734375 0.214844 6.578125 0.378906 Z M 6.390625 0.574219 "
    />
</svg>
