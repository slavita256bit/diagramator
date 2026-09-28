package library;

import java.util.ArrayList;
import java.util.List;

/** Generic container; Library owns its shelves (composition). */
public class Shelf {
    private String code;
    private final List<Item> items = new ArrayList<>();

    public void put(Item item) { items.add(item); }
}
