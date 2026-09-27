package zoo;

import java.util.List;

public class Dog extends Pet implements Animal {
    private int age;
    protected List<Toy> toys;

    public Dog(String name) { super(name); }

    @Override
    public String sound() { return "woof"; }

    void fetch(Toy toy, int times) {}
}
