package zoo;

public abstract class Pet {
    protected String name;
    private Owner owner;

    public Pet(String name) { this.name = name; }

    public abstract String sound();
}
